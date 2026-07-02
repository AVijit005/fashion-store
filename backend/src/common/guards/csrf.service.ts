import { Injectable } from '@nestjs/common';
import { randomBytes, timingSafeEqual } from 'crypto';

@Injectable()
export class CsrfService {
  generateToken(): string {
    return randomBytes(32).toString('base64');
  }

  verify(cookieToken: string | undefined, headerToken: string | undefined): boolean {
    if (!cookieToken || !headerToken) {
      return false;
    }

    const cookieBuf = Buffer.from(cookieToken);
    const headerBuf = Buffer.from(headerToken);

    if (cookieBuf.length !== headerBuf.length) {
      return false;
    }

    try {
      return timingSafeEqual(cookieBuf, headerBuf);
    } catch {
      return false;
    }
  }
}
