import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IUser } from 'src/auth/user.interface';
import { Repository } from 'typeorm';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { Recipe } from './entities/recipe.entity';

@Injectable()
export class RecipesService {
  constructor(
    @InjectRepository(Recipe) private recipeRepository: Repository<Recipe>,
  ) {}

  async create(createRecipeDto: CreateRecipeDto, user: IUser) {
    try {
      const recipe = await this.recipeRepository.create({
        ...createRecipeDto,
        author: user.sub,
      });
      return this.recipeRepository.save(recipe);
    } catch (e) {
      console.log('Error creating recipe');
      console.log(e.message || e.stack || e);
      throw e;
    }
  }

  async findAll() {
    try {
      const recipes = await this.recipeRepository.find({
        relations: ['ingredients', 'instructions'],
      });
      return recipes;
    } catch (e) {
      console.log('Error finding all recipes');
      console.log(e.message || e.stack || e);
      throw e;
    }
  }

  async findOne(id: number) {
    try {
      const recipe = await this.recipeRepository.findOne(id, {
        relations: ['ingredients', 'instructions'],
      });
      if (!recipe) {
        throw new NotFoundException(`Recipe #${id} not found`);
      }
      return recipe;
    } catch (e) {
      console.log('Error finding one recipe');
      console.log(e.message || e.stack || e);
      throw e;
    }
  }

  async update(id: number, updateRecipeDto: UpdateRecipeDto, user: IUser) {
    try {
      const existingRecipe = await this.recipeRepository.findOne(id);

      if (!existingRecipe) {
        throw new NotFoundException(`Recipe #${id} not found`);
      }

      if (existingRecipe.author !== user.sub) {
        throw new UnauthorizedException(
          `Recipe #${id} does not belong to this user`,
        );
      }

      const result = await this.recipeRepository.save({
        ...existingRecipe,
        ...updateRecipeDto,
        author: user.sub,
      });
      return result;
    } catch (e) {
      console.log('Error updating recipe');
      console.log(e.message || e.stack || e);
      throw e;
    }
  }

  async remove(id: number, user: IUser) {
    try {
      const existingRecipe = await this.recipeRepository.findOne(id);

      if (!existingRecipe) {
        throw new NotFoundException(`Recipe #${id} not found`);
      }

      if (existingRecipe.author !== user.sub) {
        throw new UnauthorizedException(
          `Recipe #${id} does not belong to this user`,
        );
      }

      const result = await this.recipeRepository.softRemove(existingRecipe);
      return result;
    } catch (e) {
      console.log('Error removing recipe');
      console.log(e.message || e.stack || e);
      throw e;
    }
  }
}
