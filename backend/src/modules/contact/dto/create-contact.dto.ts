import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateContactDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  message!: string;

  // Optional userId captured client-side when the user is logged in.
  @IsOptional()
  @IsString()
  userId?: string;
}
