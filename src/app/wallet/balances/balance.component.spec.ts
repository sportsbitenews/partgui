import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ElectronService } from 'ngx-electron';

import { BalanceComponent } from './balance.component';

import { SharedModule } from '../../shared/shared.module';
import { WalletModule } from '../wallet.module';

import { RPCService } from '../../core/rpc/rpc.service';

describe('BalanceComponent', () => {
  let component: BalanceComponent;
  let fixture: ComponentFixture<BalanceComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [
        SharedModule,
        WalletModule.forRoot()
      ],
      providers: [
        ElectronService,
        RPCService
      ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(BalanceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should get balance before point', () => {
    expect(component.getBalanceBeforePoint).toBeTruthy();
  });

  it('should get balance point', () => {
    expect(component.getBalancePoint).toBeTruthy();
  });

  it('should get balance after point', () => {
    expect(component.getBalanceAfterPoint).toBeTruthy();
  });

  it('should get type of balance', () => {
    expect(component.getTypeOfBalance).toBeTruthy();
  });

  it('should get balanceService', () => {
    expect(component.balanceService).toBeDefined();
  });
});
