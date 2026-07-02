import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { MetricsService } from './metrics.service';
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';

/**
 * MetricsController exposes the Prometheus scrape endpoint at
 *   GET /api/v1/metrics
 *
 * Access control:
 *   - In production this MUST be reachable only from the internal
 *     Prometheus scraper. We tag it noindex in Swagger and require
 *     either:
 *       - the request originates from the data network (compose
 *         network isolation already handles this), OR
 *       - the caller has the METRICS_READ role.
 *
 * The endpoint returns text/plain in the Prometheus exposition format
 * (version 0.0.4). Content-Type is set explicitly so Prometheus
 * parses the response correctly.
 */
@ApiTags('Metrics')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Prometheus scrape endpoint (internal only)',
  })
  @ApiExcludeEndpoint(false) // still visible in Swagger for ops
  // Defense in depth: even if the route leaks past the network boundary,
  // require the metrics reader role. Prometheus doesn't authenticate
  // by default, so deploy this behind a network policy OR run a sidecar
  // that adds the header before forwarding.
  @Roles('ADMIN', 'METRICS_READ')
  async scrape(): Promise<string> {
    return this.metricsService.snapshot();
  }
}
