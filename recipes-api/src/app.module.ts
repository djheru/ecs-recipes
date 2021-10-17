import { INestApplication, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RecipesModule } from './recipes/recipes.module';
import { AuthModule } from './auth/auth.module';
import { LoggerModule } from './logger/logger.module';

export const appModuleDocumentation = (app: INestApplication): void => {
  const options = new DocumentBuilder()
    .setTitle('ECS Recipes API')
    .setDescription('Service to manage recipes')
    .setVersion('1.0')
    .addTag('Recipes')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, options, {
    include: [],
  });
  SwaggerModule.setup('swagger', app, document);
};

@Module({
  imports: [TypeOrmModule.forRoot(), RecipesModule, AuthModule, LoggerModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
