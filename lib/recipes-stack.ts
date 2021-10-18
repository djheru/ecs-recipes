import { CfnOutput, Construct, RemovalPolicy, Stack, StackProps } from '@aws-cdk/core';
import {
  BastionHostLinux,
  FlowLogDestination,
  GatewayVpcEndpointAwsService,
  InstanceClass,
  InstanceSize,
  InstanceType,
  InterfaceVpcEndpointAwsService,
  Peer,
  Port,
  SecurityGroup,
  SubnetType,
  Vpc,
} from '@aws-cdk/aws-ec2';
import { Secret } from '@aws-cdk/aws-secretsmanager';
import { Secret as EcsSecret } from '@aws-cdk/aws-ecs';
import {
  Credentials,
  DatabaseInstance,
  DatabaseInstanceEngine,
  DatabaseProxy,
  PostgresEngineVersion,
} from '@aws-cdk/aws-rds';
import { ApplicationLoadBalancedFargateService } from '@aws-cdk/aws-ecs-patterns';
import { Role } from '@aws-cdk/aws-iam';
import { snakeCase } from 'snake-case';
import { EcsService, EcsServiceProps } from './ecs-service';
import { RecipesPipeline } from './recipes-pipeline';

export type Environment = 'dev' | 'prod' | 'staging' | 'test' | string;

export interface RecipesStackProps extends StackProps {
  environmentName: Environment;
  serviceName: string;
  hostedZoneDomainName: string;
  databaseUsername?: string;
  defaultDatabaseName?: string;
  deletionProtection?: boolean;
  instanceType?: InstanceType;
  maxAzs?: number;
  removalPolicy?: RemovalPolicy;
}

export class RecipesStack extends Stack {
  public id: string;
  public environmentName: Environment;
  public serviceName: string;
  public hostedZoneDomainName: string;

  // VPC Resources
  public vpc: Vpc;
  public rdsDbSg: SecurityGroup;
  public bastionHost: BastionHostLinux;

  // DB Instance Resources
  public databaseCredentialsSecret: Secret;
  public databaseCredentialsSecretName: string;
  public databaseInstance: DatabaseInstance;
  public databaseProxyEndpoint: string;

  // Service
  public ecsTaskRole: Role;
  public ecsService: EcsService;

  // CICD Pipeline
  public recipesPipeline: RecipesPipeline;

  constructor(scope: Construct, id: string, private readonly props: RecipesStackProps) {
    super(scope, id, props);

    const { environmentName, hostedZoneDomainName, serviceName } = props;
    this.id = id;
    this.environmentName = environmentName;
    this.serviceName = serviceName;
    this.hostedZoneDomainName = hostedZoneDomainName;

    this.buildResources();
  }

  buildResources() {
    this.buildVpc();
    this.buildSecurityGroup();
    this.buildBastionHost();
    this.buildDatabaseCredentialsSecret();
    this.buildDatabaseInstance();
    this.buildEcsService();
    this.buildRecipesPipeline();
  }

  buildVpc() {
    const vpcId = `${this.id}-vpc`;
    this.vpc = new Vpc(this, vpcId, {
      enableDnsHostnames: true,
      enableDnsSupport: true,
      flowLogs: {
        S3Flowlogs: {
          destination: FlowLogDestination.toS3(),
        },
      },
      maxAzs: this.props.maxAzs || 2,
      gatewayEndpoints: {
        S3: { service: GatewayVpcEndpointAwsService.S3 },
      },
    });
    this.vpc.addInterfaceEndpoint(`${vpcId}-endpoint-ecr-docker`, {
      service: InterfaceVpcEndpointAwsService.ECR_DOCKER,
    });
    this.vpc.addInterfaceEndpoint(`${vpcId}-endpoint-ecr`, {
      service: InterfaceVpcEndpointAwsService.ECR,
    });
    this.vpc.addInterfaceEndpoint(`${vpcId}-endpoint-logs`, {
      service: InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
    });
    this.vpc.addInterfaceEndpoint(`${vpcId}-endpoint-secrets-manager`, {
      service: InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
    });
  }

  buildSecurityGroup() {
    const rdsDbSgId = `${this.id}-rds-db-sg`;
    this.rdsDbSg = new SecurityGroup(this, rdsDbSgId, {
      vpc: this.vpc,
    });

    this.rdsDbSg.addIngressRule(
      this.rdsDbSg,
      Port.tcp(5432),
      'Allow connections to RDS DB from application'
    );

    const vpcOutputId = `output-vpc-id`;
    new CfnOutput(this, vpcOutputId, {
      value: this.vpc.vpcId,
      exportName: `${this.id}-${vpcOutputId}`,
    });
  }

  buildBastionHost() {
    const bastionHostId = `${this.id}-bastion-host`;
    this.bastionHost = new BastionHostLinux(this, bastionHostId, {
      vpc: this.vpc,
      instanceName: bastionHostId,
      subnetSelection: {
        subnetType: SubnetType.PUBLIC,
      },
      securityGroup: this.rdsDbSg,
    });

    this.bastionHost.allowSshAccessFrom(Peer.anyIpv4());

    const bastionHostnameOutputId = `output-bastion-hostname`;
    new CfnOutput(this, bastionHostnameOutputId, {
      value: this.bastionHost.instancePublicDnsName,
      exportName: `${this.id}-${bastionHostnameOutputId}`,
    });

    const bastionIdOutputId = `output-bastion-id`;
    new CfnOutput(this, bastionIdOutputId, {
      value: this.bastionHost.instanceId,
      exportName: `${this.id}-${bastionIdOutputId}`,
    });
  }

  buildDatabaseCredentialsSecret() {
    this.databaseCredentialsSecretName = `${this.id}-db-secret`;
    this.databaseCredentialsSecret = new Secret(this, this.databaseCredentialsSecretName, {
      secretName: this.databaseCredentialsSecretName,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: this.props.databaseUsername || snakeCase(`${this.id}`),
        }),
        excludePunctuation: true,
        includeSpace: false,
        generateStringKey: 'password',
      },
    });

    const dbCredentialsSecretNameOutputId = `db-credentials-secret-name`;
    new CfnOutput(this, dbCredentialsSecretNameOutputId, {
      value: this.databaseCredentialsSecret.secretName,
      exportName: `${this.id}-${dbCredentialsSecretNameOutputId}`,
    });
  }

  buildDatabaseInstance() {
    const databaseInstanceId = `${this.id}-db`;
    this.databaseInstance = new DatabaseInstance(this, databaseInstanceId, {
      deletionProtection: this.props.deletionProtection || false,
      removalPolicy: this.props.removalPolicy || RemovalPolicy.DESTROY,
      databaseName: this.props.defaultDatabaseName || snakeCase(this.id),
      engine: DatabaseInstanceEngine.postgres({
        version: PostgresEngineVersion.VER_12,
      }),
      instanceType: InstanceType.of(InstanceClass.T4G, InstanceSize.MICRO),
      instanceIdentifier: `${databaseInstanceId}-id`,
      credentials: Credentials.fromSecret(this.databaseCredentialsSecret),
      vpc: this.vpc,
      vpcSubnets: {
        subnetType: SubnetType.PRIVATE_WITH_NAT,
      },
      securityGroups: [this.rdsDbSg],
    });

    const rdsDbOutputId = `db-endpoint`;
    new CfnOutput(this, rdsDbOutputId, {
      value: this.databaseInstance.instanceEndpoint.hostname,
      exportName: `${this.id}-${rdsDbOutputId}`,
    });
  }

  buildEcsService() {
    const taskEnvironment = {
      NAME: 'dealership-manager',
      NODE_ENV: this.environmentName,
      ADDRESS: '0.0.0.0',
      PORT: '4000',
      NO_COLOR: 'true',
    };
    const taskSecrets = {
      PGUSER: EcsSecret.fromSecretsManager(this.databaseCredentialsSecret, 'username'),
      PGPASSWORD: EcsSecret.fromSecretsManager(this.databaseCredentialsSecret, 'password'),
      PGDATABASE: EcsSecret.fromSecretsManager(this.databaseCredentialsSecret, 'dbname'),
      PGHOST: EcsSecret.fromSecretsManager(this.databaseCredentialsSecret, 'host'),
      PGPORT: EcsSecret.fromSecretsManager(this.databaseCredentialsSecret, 'port'),
    };

    const ecsServiceId = `${this.id}-service`;
    this.ecsService = new EcsService(this, ecsServiceId, {
      environmentName: this.environmentName,
      hostedZoneDomainName: this.hostedZoneDomainName,
      securityGroup: this.rdsDbSg,
      serviceName: this.serviceName,
      taskEnvironment,
      taskSecrets,
      vpc: this.vpc,
      autoscalingConfig: {
        maxCapacity: 4,
        minCapacity: 1,
        cpuTargetUtilizationPercent: 50,
        ramTargetUtilizationPercent: 50,
      },
    });
  }

  buildRecipesPipeline() {
    const recipesPipelineId = `${this.id}-cicd`;
    this.recipesPipeline = new RecipesPipeline(this, recipesPipelineId, {
      cluster: this.ecsService.cluster,
      databaseCredentialsSecretArn: this.databaseCredentialsSecret.secretArn,
      environmentName: this.environmentName,
      repository: this.ecsService.ecrRepository,
      securityGroup: this.rdsDbSg,
      service: this.ecsService.service,
      vpc: this.vpc,
    });
  }
}
