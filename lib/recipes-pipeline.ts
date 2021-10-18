import { PipelineProject } from '@aws-cdk/aws-codebuild';
import { Artifact, ArtifactPath, Pipeline } from '@aws-cdk/aws-codepipeline';
import { CodeBuildAction, EcsDeployAction, GitHubSourceAction } from '@aws-cdk/aws-codepipeline-actions';
import { ISecurityGroup, IVpc } from '@aws-cdk/aws-ec2';
import { IRepository } from '@aws-cdk/aws-ecr';
import { ICluster } from '@aws-cdk/aws-ecs';
import { ApplicationLoadBalancedFargateService } from '@aws-cdk/aws-ecs-patterns';
import { ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from '@aws-cdk/aws-iam';
import { Construct, SecretValue, Stack } from '@aws-cdk/core';
import { pascalCase } from 'pascal-case';
import { EcsService } from './ecs-service';
import { apiProjectConfig, infrastructureProjectConfig, migrationProjectConfig } from './project-buildspec';
import { Environment } from './recipes-stack';

export interface RecipesPipelineProps {
  cluster: ICluster;
  databaseCredentialsSecretArn: string;
  environmentName: Environment;
  repository: IRepository;
  securityGroup: ISecurityGroup;
  service: EcsService;
  vpc: IVpc;
}

export class RecipesPipeline extends Construct {
  static CDK_VERSION = '1.128.0';
  static GITHUB_TOKEN_SECRET_NAME = 'github-token';
  static REPO_NAME = 'ecs-recipes';
  static REPO_OWNER = 'djheru';
  static environmentBranchMapping: Record<string, string> = {
    dev: 'dev',
    test: 'test',
    prod: 'main',
  };

  public sourceAction: GitHubSourceAction;

  public sourceArtifact = new Artifact();
  public buildArtifact = new Artifact();

  private infrastructureRole: Role;
  private infrastructureAction: CodeBuildAction;
  private apiAction: CodeBuildAction;
  private migrationAction: CodeBuildAction;
  private deployApiAction: EcsDeployAction;

  constructor(scope: Construct, public readonly id: string, private readonly props: RecipesPipelineProps) {
    super(scope, id);

    this.id = id;

    this.buildResources();
  }

  buildResources() {
    this.buildSourceAction();
    this.buildInfrastructureRole();
    this.buildInfrastructureAction();
    this.buildApiAction();
    this.buildMigrationAction();
    this.buildDeployApiAction();
    this.buildPipeline();
  }

  buildSourceAction() {
    const branch =
      RecipesPipeline.environmentBranchMapping[this.props.environmentName] || this.props.environmentName;
    const oauthToken = SecretValue.secretsManager(RecipesPipeline.GITHUB_TOKEN_SECRET_NAME);
    const sourceActionId = `source-action`;
    this.sourceAction = new GitHubSourceAction({
      actionName: pascalCase(sourceActionId),
      owner: RecipesPipeline.REPO_OWNER,
      repo: RecipesPipeline.REPO_NAME,
      branch,
      oauthToken,
      output: this.sourceArtifact,
    });
  }

  buildInfrastructureRole() {
    const infrastructureRoleId = `${this.id}-infrastructure-role`;
    this.infrastructureRole = new Role(this, infrastructureRoleId, {
      assumedBy: new ServicePrincipal('codebuild.amazonaws.com'),
      managedPolicies: [ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess')],
      roleName: infrastructureRoleId,
    });
  }

  buildInfrastructureAction() {
    const projectConfig = infrastructureProjectConfig({
      id: this.id,
      environmentName: this.props.environmentName,
      stackName: Stack.of(this).stackName,
      role: this.infrastructureRole,
    });
    const infrastructureProjectId = `${this.id}-infrastructure-project`;
    const infrastructureProject = new PipelineProject(this, infrastructureProjectId, projectConfig);

    const infrastructureActionId = `infrastructure-action`;
    this.infrastructureAction = new CodeBuildAction({
      actionName: pascalCase(infrastructureActionId),
      input: this.sourceArtifact,
      project: infrastructureProject,
    });
  }

  buildApiAction() {
    const projectConfig = apiProjectConfig({
      id: this.id,
      environmentName: this.props.environmentName,
      serviceName: this.props.service.id,
      clusterName: this.props.cluster.clusterName,
      repositoryName: this.props.repository.repositoryName,
      repositoryUri: this.props.repository.repositoryUri,
      sourcePath: './application',
    });
    const buildApiProjectId = `${this.id}-build-api-project`;
    const buildApiProject = new PipelineProject(this, buildApiProjectId, projectConfig);

    this.props.repository.grantPullPush(<Role>buildApiProject.role);
    buildApiProject.addToRolePolicy(
      new PolicyStatement({
        actions: [
          'ecs:DescribeCluster',
          'ecr:GetAuthorizationToken',
          'ecr:BatchCheckLayerAvailability',
          'ecr:BatchGetImage',
          'ecr:GetDownloadUrlForLayer',
        ],
        resources: [this.props.cluster.clusterArn],
      })
    );

    const apiActionId = `build-api-action`;
    this.apiAction = new CodeBuildAction({
      actionName: pascalCase(apiActionId),
      input: this.sourceArtifact,
      project: buildApiProject,
      outputs: [this.buildArtifact],
    });
  }

  buildMigrationAction() {
    const projectConfig = migrationProjectConfig({
      databaseCredentialsSecretArn: this.props.databaseCredentialsSecretArn,
      environmentName: this.props.environmentName,
      id: this.id,
      securityGroup: this.props.securityGroup,
      sourcePath: './application',
      vpc: this.props.vpc,
    });
    const migrationProjectId = `${this.id}-migration-project`;
    const migrationProject = new PipelineProject(this, migrationProjectId, projectConfig);

    const migrationActionId = `run-migrations-action`;
    this.migrationAction = new CodeBuildAction({
      actionName: pascalCase(migrationActionId),
      input: this.sourceArtifact,
      project: migrationProject,
    });
  }

  buildDeployApiAction() {
    const deployApiActionId = `deploy-api-action`;
    this.deployApiAction = new EcsDeployAction({
      actionName: pascalCase(deployApiActionId),
      service: this.props.service.service.service,
      imageFile: new ArtifactPath(this.buildArtifact, 'imagedefinitions.json'),
    });
  }

  buildPipeline() {
    const pipelineId = `${this.id}-pipeline`;
    new Pipeline(this, pipelineId, {
      pipelineName: this.id,
      restartExecutionOnUpdate: true,
      stages: [
        {
          stageName: 'CheckoutSource',
          actions: [this.sourceAction],
        },
        {
          stageName: 'DeployInfrastructure',
          actions: [this.infrastructureAction],
        },
        {
          stageName: 'BuildAPI',
          actions: [this.apiAction],
        },
        {
          stageName: 'DeployAPI',
          actions: [this.deployApiAction, this.migrationAction],
        },
      ],
    });
  }
}
