import { Module } from "@nestjs/common";
import {
  RestockNotificationsController,
  AdminRestockNotificationsController,
} from "./restock-notifications.controller";
import { RestockNotificationsService } from "./restock-notifications.service";
import { PrismaModule } from "../../config/prisma.module";
import { EmailModule } from "../email/email.module";

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [
    RestockNotificationsController,
    AdminRestockNotificationsController,
  ],
  providers: [RestockNotificationsService],
  exports: [RestockNotificationsService],
})
export class RestockNotificationsModule {}
