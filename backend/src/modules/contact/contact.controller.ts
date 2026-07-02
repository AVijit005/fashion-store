import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ContactService } from "./contact.service";
import { CreateContactDto } from "./dto/create-contact.dto";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";

// Public endpoint — anyone visiting /contact can submit.
// Rate-limited at 5/hr per IP to prevent abuse.
@Controller("contact")
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60 * 60 * 1000 } })
  async submit(@Body() dto: CreateContactDto) {
    return this.contact.submit(dto);
  }
}

// Admin endpoint — list all submissions.
@Controller("admin/contact")
@UseGuards(AuthGuard, RolesGuard)
@Roles("ADMIN")
export class AdminContactController {
  constructor(private readonly contact: ContactService) {}

  @Get()
  list() {
    return this.contact.listAll();
  }
}
