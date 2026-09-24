import { Test, TestingModule } from '@nestjs/testing';
import { OtpsController } from './otps.controller';

describe('OtpsController', () => {
  let controller: OtpsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OtpsController],
    }).compile();

    controller = module.get<OtpsController>(OtpsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
