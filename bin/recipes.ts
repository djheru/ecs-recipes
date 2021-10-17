#!/usr/bin/env node
import 'source-map-support/register';
import { App, StackProps, Tags } from '@aws-cdk/core';
import { RecipesStack } from '../lib/recipes-stack';
import { snakeCase } from 'change-case';

const {
  CDK_ENV: environmentName = 'dev',
  CDK_DEFAULT_ACCOUNT,
  AWS_DEFAULT_ACCOUNT_ID,
  CDK_DEFAULT_REGION,
  AWS_DEFAULT_REGION,
} = process.env;

const account = CDK_DEFAULT_ACCOUNT || AWS_DEFAULT_ACCOUNT_ID;
const region = CDK_DEFAULT_REGION || AWS_DEFAULT_REGION;

const app = new App();

const recipesStackProps: StackProps = {
  description: `Summary: This stack is responsible for handling the RecipesStack resources.

Deployment: This stack supports deployments to the standard environments. The stack 
can be deployed to a custom environment (e.g. a developer environment) by ensuring 
that the desired environment name (e.g. ${environmentName}) is set in the $CDK_ENV environment 
variable`,
  env: {
    account,
    region,
  },
};

const hostedZoneDomainName = 'online-cuisine.com';
const serviceName = 'recipes';

const stackId = `${serviceName}-${environmentName}`;
const recipesStack = new RecipesStack(app, stackId, {
  ...recipesStackProps,
  defaultDatabaseName: snakeCase(serviceName),
  environmentName,
  hostedZoneDomainName,
  serviceName,
});

Tags.of(recipesStack).add('application', 'ecs-recipes');
Tags.of(recipesStack).add('stack', serviceName);
Tags.of(recipesStack).add('environmentName', environmentName);
