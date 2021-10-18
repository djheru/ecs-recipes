### Build for development
FROM node:stretch-slim as development
ENV NODE_ENV=development
WORKDIR /usr/src/app
# Install development packages so we can build and test
COPY package.json yarn.lock ormconfig.js tsconfig.build.json tsconfig.json ./
RUN yarn install --silent
# Copy the files from the local environment
COPY . .
# Transpile TS to JS
RUN yarn build

# -----------------------------------------------------------------------

### Build for test
FROM node:stretch-slim as test
ARG NODE_ENV=test
ENV NODE_ENV=${NODE_ENV}
WORKDIR /usr/src/app
# Copy the installed and built files from the development stage
COPY --from=development /usr/src/app ./
RUN yarn test --passWithNoTests

# -----------------------------------------------------------------------

### Build for production
FROM node:stretch-slim as production
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
WORKDIR /usr/src/app
COPY package.json yarn.lock ormconfig.js tsconfig.build.json tsconfig.json ./
RUN yarn install --production --silent
# Copy the build files from the development stage
COPY --from=development /usr/src/app/dist ./dist
CMD ["node", "dist/main"]
