import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { CartModule } from 'src/cart/cart.module';

@Module({
  imports: [PrismaModule, CartModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
