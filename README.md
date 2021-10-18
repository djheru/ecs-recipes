# Welcome to your CDK TypeScript project!

This is a blank project for TypeScript development with CDK.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

- `npm run build` compile typescript to js
- `npm run watch` watch for changes and compile
- `npm run test` perform the jest unit tests
- `cdk deploy` deploy this stack to your default AWS account/region
- `cdk diff` compare deployed stack with current state
- `cdk synth` emits the synthesized CloudFormation template

```
aws ecr get-login-password \
  --region us-east-1 | \
  docker login \
    --username AWS \
    --password-stdin \
    205375198116.dkr.ecr.us-east-1.amazonaws.com

docker build -t ecs-recipes-pdamra/recipes .

docker tag ecs-recipes-pdamra/recipes:latest 205375198116.dkr.ecr.us-east-1.amazonaws.com/ecs-recipes-pdamra/recipes:latest

docker push 205375198116.dkr.ecr.us-east-1.amazonaws.com/ecs-recipes-pdamra/recipes:latest
```
