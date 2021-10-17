import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { IUser } from './user.interface';

export const User = createParamDecorator(
  (data, ctx: ExecutionContext): IUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as IUser;
  },
);
