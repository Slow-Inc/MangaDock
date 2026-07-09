import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsMiddleware } from './metrics.middleware';
import { BusinessMetricsService } from './business-metrics.service';

@Module({
  controllers: [MetricsController],
  providers: [BusinessMetricsService],
  exports: [BusinessMetricsService],
})
export class MetricsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(MetricsMiddleware)
      .exclude({ path: 'metrics', method: RequestMethod.GET })
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
