import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { RecipesService } from './recipes.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { AuthGuard } from '@nestjs/passport';
import { IUser } from 'src/auth/user.interface';
import { User } from 'src/auth/user.decorator';
import { LoggerService } from 'src/logger/logger.service';

@Controller('recipes')
export class RecipesController {
  private readonly logger = new LoggerService(RecipesController.name, true);

  constructor(private readonly recipesService: RecipesService) {}

  @Get()
  async findAll() {
    try {
      this.logger.verbose('findAll');
      const response = await this.recipesService.findAll();
      this.logger.log({ response });
      return response;
    } catch (e) {
      this.logger.error(e.message || e.stack || e);
      throw e;
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      this.logger.verbose('findAll');
      const response = await this.recipesService.findOne(+id);
      this.logger.log({ response });
      return response;
    } catch (e) {
      this.logger.error(e.message || e.stack || e);
      throw e;
    }
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  async create(@Body() createRecipeDto: CreateRecipeDto, @User() user: IUser) {
    try {
      this.logger.verbose('findAll');
      const response = await this.recipesService.create(createRecipeDto, user);
      this.logger.log({ response });
      return response;
    } catch (e) {
      this.logger.error(e.message || e.stack || e);
      throw e;
    }
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  async update(@Param('id') id: string, @Body() updateRecipeDto: UpdateRecipeDto, @User() user: IUser) {
    try {
      this.logger.verbose('findAll');
      const response = await this.recipesService.update(+id, updateRecipeDto, user);
      this.logger.log({ response });
      return response;
    } catch (e) {
      this.logger.error(e.message || e.stack || e);
      throw e;
    }
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  async remove(@Param('id') id: string, @User() user: IUser) {
    try {
      this.logger.verbose('findAll');
      const response = await this.recipesService.remove(+id, user);
      this.logger.log({ response });
      return response;
    } catch (e) {
      this.logger.error(e.message || e.stack || e);
      throw e;
    }
  }
}
