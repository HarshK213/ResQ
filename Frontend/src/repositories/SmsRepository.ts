import type { CreateEmergencyPayload } from '../types/emergency';
import type { AppRegisterRequest } from '../types/auth';
import { SmsCommunicationService } from '../services/communication';
import env from '../config/env';

export interface ISmsRepository {
  sendRegistration(data: AppRegisterRequest): Promise<boolean>;
  sendEmergency(data: CreateEmergencyPayload): Promise<boolean>;
  setGatewayNumber(number: string): void;
  setUseNativeSms(use: boolean): void;
}

export class SmsRepository implements ISmsRepository {
  private smsService: SmsCommunicationService;

  constructor() {
    this.smsService = new SmsCommunicationService(
      env.smsGatewayNumber,
      !env.smsGatewayEnabled,
    );
  }

  async sendRegistration(data: AppRegisterRequest): Promise<boolean> {
    console.log(`\n📱 [SMS] --> Registration via SMS to ${env.smsGatewayNumber}`);
    console.log(`📱 [SMS] --> Data:`, JSON.stringify(data, null, 2));
    const result = await this.smsService.sendRegistration(data);
    console.log(`📱 [SMS] <-- ${result ? 'Sent' : 'Failed'}`);
    return result;
  }

  async sendEmergency(data: CreateEmergencyPayload): Promise<boolean> {
    console.log(`\n📱 [SMS] --> Emergency via SMS to ${env.smsGatewayNumber}`);
    console.log(`📱 [SMS] --> Data:`, JSON.stringify(data, null, 2));
    const result = await this.smsService.sendEmergency(data);
    console.log(`📱 [SMS] <-- ${result ? 'Sent' : 'Failed'}`);
    return result;
  }

  setGatewayNumber(number: string): void {
    this.smsService.setSmsGatewayNumber(number);
  }

  setUseNativeSms(use: boolean): void {
    this.smsService.setUseNativeSms(use);
  }
}

export default new SmsRepository();
