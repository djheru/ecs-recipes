<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo_text.svg" width="320" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://coveralls.io/github/nestjs/nest?branch=master" target="_blank"><img src="https://coveralls.io/repos/github/nestjs/nest/badge.svg?branch=master#9" alt="Coverage" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Installation

```bash
$ npm install
```

## Running the app

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Test

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://kamilmysliwiec.com)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](LICENSE).

---

# ECS Recipes

Boilerplate project for running a NestJS application in AWS ecosystem

Contains the following:

- REST API with NestJS
- Database persistence with TypeORM
- Authentication with Auth0
- Infrastructure as Code with AWS CDK
- AWS ECS service running the API in docker
- AWS RDS database with ECS Task for migrations
- Load balancer in front of the API
- DNS record and SSL certificate for custom domain name and HTTPS connection
- Continuous integration pipeline with AWS CodePipeline and CodeBuild

## The API

Rest API to store recipes. Nothing too special.

## Getting started

1. Install the NestJS CLI

```
npm i -g @nestjs/cli
```

2. Scaffold out a starter application

```
nest new ecs-recipes
```

3. Navigate to http://localhost:3000/

## Creating the Recipes resource

1. Generate the boilerplate

```
nest generate resource recipes
```

2. Test out the boilerplate endpoints (e.g. GET /recipes, GET /recipes/1, PATCH /recipes/1 etc)

## Add TypeORM

1. Install the npm modules

```
npm install --save @nestjs/typeorm typeorm pg
```

2. Define entities (e.g. ./src/recipes/entities/recipe.entity.ts)

3. Generate initial migrations

```
typeorm migration:generate -n InitialMigration
```

4. Run migration

```
typeorm migration:run
```

## Integrate with Auth0

This section assumes that you've already created an account

### Create new API

- Select the "Applications" heading from the left-side navigation and navigate to the "APIs" page
- Select the "Create API" button on the top right
- Enter a name for the API, e.g. ECS Recipes
- Enter a URI for the "Identifier" field. This doesn't need to be a real URI. It's just a logical identifier for the API (e.g. `https://ecs-recipes/`). This will be used as the OAuth "Audience" value
- Ensure that "RS256" is selected for the Signing Algorithm, then press "Create"
- Navigate to the "Applications" item on the left-side navigation and note the Application that was automatically created for you.
  - This is a machine-to-machine application, convienient for testing
  - We would create an additional application for, say, a React application to use for authentication
- Click the "Settings" tab if it's not already selected
- Enter `http://localhost:3000` as the value for the "Allowed Callback URLs" field
- Click "Save Changes" to continue
- Take note of the "Client ID", "Client Secret" and "Domain" fields
