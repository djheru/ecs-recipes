import { SecurityGroup, Vpc } from '@aws-cdk/aws-ec2';
import { Cluster, ContainerImage, FargateTaskDefinition, Secret as EcsSecret } from '@aws-cdk/aws-ecs';
import { ApplicationLoadBalancedFargateService } from '@aws-cdk/aws-ecs-patterns';
import {
  AccountRootPrincipal,
  Effect,
  ManagedPolicy,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from '@aws-cdk/aws-iam';
import { HostedZone, IHostedZone } from '@aws-cdk/aws-route53';
import { CfnOutput, Construct } from '@aws-cdk/core';
import { Repository as EcrRepository } from '@aws-cdk/aws-ecr';
import { Environment } from './recipes-stack';
import { Project } from '@aws-cdk/aws-codebuild';
import { Artifact, Pipeline } from '@aws-cdk/aws-codepipeline';
import { GitHubSourceAction } from '@aws-cdk/aws-codepipeline-actions';
import { Certificate, CertificateValidation } from '@aws-cdk/aws-certificatemanager';
import { ApplicationProtocol } from '@aws-cdk/aws-elasticloadbalancingv2';

export interface AutoScalingConfig {
  maxCapacity?: number;
  minCapacity?: number;
  cpuTargetUtilizationPercent?: number;
  ramTargetUtilizationPercent?: number;
}

export interface EcsServiceProps {
  environmentName: Environment;
  hostedZoneDomainName: string;
  securityGroup: SecurityGroup;
  serviceName: string;
  taskEnvironment: Record<string, string>;
  taskSecrets: Record<string, EcsSecret>;
  vpc: Vpc;
  autoscalingConfig?: AutoScalingConfig;
}

export class EcsService extends Construct {
  public id: string;
  public certificate: Certificate;
  public domainName: string;
  public serviceName: string;
  public environmentName: Environment;
  public hostedZoneDomainName: string;
  public securityGroup: SecurityGroup;
  public taskEnvironment: Record<string, string>;
  public taskSecrets: Record<string, EcsSecret>;
  public vpc: Vpc;
  public autoscalingConfig: AutoScalingConfig;

  public domainNameBase: string;
  public hostedZone: IHostedZone;
  public clusterAdminRole: Role;
  public taskRole: Role;
  public cluster: Cluster;
  public ecsExecutionRolePolicy: PolicyStatement;
  public service: ApplicationLoadBalancedFargateService;
  public migrationTask: FargateTaskDefinition;
  public gitHubSourceAction: GitHubSourceAction;
  public ecrRepository: EcrRepository;

  public project: Project;
  private pipeline: Pipeline;

  public sourceArtifact = new Artifact();
  public buildArtifact = new Artifact();

  constructor(scope: Construct, id: string, props: EcsServiceProps) {
    super(scope, id);

    const {
      environmentName,
      hostedZoneDomainName,
      securityGroup,
      serviceName,
      taskEnvironment,
      taskSecrets,
      vpc,
      autoscalingConfig,
    } = props;

    this.id = id;
    this.environmentName = environmentName;
    this.hostedZoneDomainName = hostedZoneDomainName;
    this.serviceName = serviceName;

    this.domainNameBase = `${this.environmentName}.${this.hostedZoneDomainName}`;
    this.domainName = `${this.serviceName}.${this.domainNameBase}`;

    this.vpc = vpc;
    this.securityGroup = securityGroup;

    this.taskEnvironment = taskEnvironment;
    this.taskSecrets = taskSecrets;
    this.autoscalingConfig = autoscalingConfig || {};

    this.buildResources();
  }

  buildResources() {
    this.buildEcrRepository();
    this.buildRoles();
    this.loadHostedZone();
    this.createCertificate();
    this.buildCluster();
    this.buildExecutionRolePolicyStatement();
    this.buildEcsService();
    this.configureServiceAutoscaling();
  }

  buildEcrRepository() {
    const ecrRepositoryId = `${this.id}-ecr-repository`;
    this.ecrRepository = new EcrRepository(this, ecrRepositoryId, {
      imageScanOnPush: true,
      repositoryName: `ecs-recipes/${this.serviceName}`,
      lifecycleRules: [
        {
          description: 'Remove old images',
          maxImageCount: 50,
        },
      ],
    });
    const ecrRepositoryOutputId = `ecr-repo-uri`;
    new CfnOutput(this, ecrRepositoryOutputId, {
      value: this.ecrRepository.repositoryUri,
      exportName: `${this.id}-${ecrRepositoryOutputId}`,
    });
  }

  buildRoles() {
    const clusterAdminRoleId = `${this.id}-cluster-admin-role`;
    this.clusterAdminRole = new Role(this, clusterAdminRoleId, {
      assumedBy: new AccountRootPrincipal(),
    });

    const taskRoleId = `${this.id}-task-role`;
    this.taskRole = new Role(this, taskRoleId, {
      roleName: taskRoleId,
      assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });
  }

  private loadHostedZone() {
    const hostedZoneId = `${this.id}-hostedZone`;
    this.hostedZone = HostedZone.fromLookup(this, hostedZoneId, {
      domainName: this.hostedZoneDomainName,
      privateZone: false,
    });
  }

  private createCertificate() {
    const certificateId = `${this.id}-certificate`;
    this.certificate = new Certificate(this, certificateId, {
      domainName: this.domainName,
      validation: CertificateValidation.fromDns(this.hostedZone),
    });
  }

  buildCluster() {
    const clusterId = `${this.id}-cluster`;
    this.cluster = new Cluster(this, clusterId, {
      vpc: this.vpc,
      clusterName: clusterId,
    });
  }

  buildExecutionRolePolicyStatement() {
    this.ecsExecutionRolePolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      resources: ['*'],
      actions: [
        'ecr:GetAuthorizationToken',
        'ecr:BatchCheckLayerAvailability',
        'ecr:GetDownloadUrlForLayer',
        'ecr:BatchGetImage',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
      ],
    });
  }

  buildEcsService() {
    const serviceId = `${this.id}-ecs`;
    this.service = new ApplicationLoadBalancedFargateService(this, serviceId, {
      assignPublicIp: false,
      cluster: this.cluster,
      cpu: 1024,
      memoryLimitMiB: 2048,
      domainName: this.domainName,
      domainZone: this.hostedZone,
      certificate: this.certificate,
      circuitBreaker: { rollback: false },
      loadBalancerName: `${this.id}-lb`,
      protocol: ApplicationProtocol.HTTPS,
      redirectHTTP: true,
      securityGroups: [this.securityGroup],
      serviceName: serviceId,
      taskImageOptions: {
        containerName: this.id,
        containerPort: this.taskEnvironment.PORT ? parseInt(this.taskEnvironment.PORT) : 4000,
        image: ContainerImage.fromEcrRepository(this.ecrRepository),
        taskRole: this.taskRole,
        environment: this.taskEnvironment,
        secrets: this.taskSecrets,
      },
    });

    this.service.taskDefinition.addToExecutionRolePolicy(this.ecsExecutionRolePolicy);
  }

  configureServiceAutoscaling() {
    const {
      maxCapacity = 4,
      minCapacity = 1,
      cpuTargetUtilizationPercent = 50,
      ramTargetUtilizationPercent = 50,
    } = this.autoscalingConfig;

    const scalableTarget = this.service.service.autoScaleTaskCount({
      maxCapacity,
      minCapacity,
    });

    scalableTarget.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: cpuTargetUtilizationPercent,
    });

    scalableTarget.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: ramTargetUtilizationPercent,
    });
  }
}
