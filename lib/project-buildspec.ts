import { BuildEnvironmentVariableType, BuildSpec, LinuxBuildImage, Source } from '@aws-cdk/aws-codebuild';
import { ISecurityGroup, IVpc } from '@aws-cdk/aws-ec2';
import { Role } from '@aws-cdk/aws-iam';
import { pascalCase } from 'pascal-case';
import { Environment } from './recipes-stack';

export const CDK_VERSION = '1.128.0';

export interface InfrastructureProjectConfigParams {
  id: string;
  environmentName: Environment;
  stackName: string;
  role: Role;
}
export const infrastructureProjectConfig = ({
  id,
  environmentName,
  stackName,
  role,
}: InfrastructureProjectConfigParams) => ({
  projectName: pascalCase(`${id}-infrastructure-build`),
  concurrentBuildLimit: 1,
  description: 'CodeBuild project to perform CDK deployments on the Application DB stack',
  environment: {
    buildImage: LinuxBuildImage.AMAZON_LINUX_2_3,
    privileged: true,
  },
  environmentVariables: {
    CDK_ENV: {
      value: environmentName,
    },
    CDK_DEBUG: {
      value: 'true',
    },
  },
  buildSpec: BuildSpec.fromObject({
    version: '0.2',
    phases: {
      install: {
        commands: [
          'echo Build started at `date`',
          `echo Beginning infrastructure build operations for "${id}"`,
          'npm i --silent',
          `npm i -g typescript aws-cdk@${CDK_VERSION}`,
        ],
      },
      build: { commands: ['npm run build'] },
      post_build: {
        commands: [
          'echo Updating the Application DB CDK infrastructure stack...',
          `cdk deploy ${stackName} --require-approval never --no-color`,
          'echo Build completed at `date`',
        ],
      },
    },
  }),
  role,
});

export interface ApiProjectConfigParams {
  id: string;
  clusterName: string;
  environmentName: Environment;
  repositoryName: string;
  repositoryUri: string;
  sourcePath: string;
  stackName: string;
}

export const apiProjectConfig = ({
  clusterName,
  id,
  repositoryName,
  repositoryUri,
  sourcePath,
}: ApiProjectConfigParams) => ({
  projectName: pascalCase(`${id}-api-build`),
  environment: {
    buildImage: LinuxBuildImage.AMAZON_LINUX_2_2,
    privileged: true,
  },
  environmentVariables: {
    CLUSTER_NAME: {
      value: clusterName,
    },
    ECR_REPO_URI: {
      value: repositoryUri,
    },
  },
  buildSpec: BuildSpec.fromObject({
    version: '0.2',
    phases: {
      pre_build: {
        commands: [
          'echo Build started at `date`',
          `cd ${sourcePath}`,
          'yarn global add @nestjs/cli typeorm',
          'yarn install --silent',
          'export TAG=${CODEBUILD_RESOLVED_SOURCE_VERSION:0:8}',
          `echo Beginning build operations for "${repositoryName}"`,
          'echo Logging in to AWS ECR...',
          '$(aws ecr get-login --no-include-email --region us-east-1)',
        ],
      },
      build: {
        commands: [
          'yarn build',
          'echo Building the Docker image...',
          'echo DOCKER TAG: $TAG',
          'echo Tagging the Docker image...',
          'docker build -t $ECR_REPO_URI:$TAG . --progress=plain',
          'docker tag $ECR_REPO_URI:$TAG $ECR_REPO_URI:latest',
        ],
      },
      post_build: {
        commands: [
          'echo Pushing the Docker image...',
          'docker push $ECR_REPO_URI:$TAG',
          'docker push $ECR_REPO_URI:latest',
          `echo "Saving new imagedefinitions.json as build artifact..."`,
          `printf '[{"name": "${id}", "imageUri": "%s"}]' $ECR_REPO_URI:$TAG > imagedefinitions.json`,
          'cat imagedefinitions.json',
          'echo Build completed on `date`',
        ],
      },
    },
    artifacts: {
      files: ['imagedefinitions.json'],
      'base-directory': sourcePath,
      'discard-paths': true,
    },
  }),
});

export interface MigrationProjectConfigProps {
  id: string;
  environmentName: Environment;
  databaseCredentialsSecretArn: string;
  securityGroup: ISecurityGroup;
  sourcePath: string;
  vpc: IVpc;
}

export const migrationProjectConfig = ({
  databaseCredentialsSecretArn,
  environmentName,
  id,
  securityGroup,
  sourcePath,
  vpc,
}: MigrationProjectConfigProps) => ({
  projectName: pascalCase(`${id}-migration-build`),
  checkSecretsInPlainTextEnvVariables: true,
  concurrentBuildLimit: 1,
  description: 'CodeBuild project to perform DB migrations on the Application DB',
  environment: {
    buildImage: LinuxBuildImage.STANDARD_5_0,
  },
  environmentVariables: {
    CDK_ENV: {
      value: environmentName,
    },
    PGUSER: {
      value: `${databaseCredentialsSecretArn}:username`,
      type: BuildEnvironmentVariableType.SECRETS_MANAGER,
    },
    PGHOST: {
      value: `${databaseCredentialsSecretArn}:host`,
      type: BuildEnvironmentVariableType.SECRETS_MANAGER,
    },
    PGPORT: {
      value: `${databaseCredentialsSecretArn}:port`,
      type: BuildEnvironmentVariableType.SECRETS_MANAGER,
    },
    PGDATABASE: {
      value: `${databaseCredentialsSecretArn}:dbname`,
      type: BuildEnvironmentVariableType.SECRETS_MANAGER,
    },
    PGPASSWORD: {
      value: `${databaseCredentialsSecretArn}:password`,
      type: BuildEnvironmentVariableType.SECRETS_MANAGER,
    },
  },
  securityGroups: [securityGroup],
  vpc: vpc,
  buildSpec: BuildSpec.fromObject({
    version: '0.2',
    phases: {
      install: {
        commands: [
          'echo Build started at `date`',
          `cd ${sourcePath}`,
          'npm i --silent',
          'npm i -g typeorm typescript --silent',
        ],
      },
      build: {
        commands: ['npm run build'],
      },
      post_build: {
        commands: ['npm run migrate', 'echo Build completed at `date`'],
      },
    },
  }),
});
