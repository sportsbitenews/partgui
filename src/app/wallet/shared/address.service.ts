import { Injectable } from '@angular/core';
import { Log } from 'ng2-logger';
import { Observable, Observer } from 'rxjs'; // use this for testing atm

import { Address, deserialize, TEST_ADDRESSES_JSON } from './address.model';
import { RPCService } from '../../core/rpc/rpc.service';


@Injectable()
export class AddressService {
  private log: any = Log.create('address.service');

  private typeOfAddresses: string = 'send'; // "receive","send", "total"

  // Stores address objects.
  private _addresses: Observable<Array<Address>>;
  private _observerAddresses: Observer<Array<Address>>;
  // Settings
  addressType: string = 'send'; // "receive","send", "total"

  /**
    * How many addresses do we display per page and keep in memory at all times. When loading more
    * addresses they are fetched JIT and added to addresses.
    */
  MAX_ADDRESSES_PER_PAGE: number = 5;

  private addressCount: number = 0;

  // Stores address objects.
  addresses: Address[] = [];

  // Pagination stuff
  currentPage: number = 0;
  totalPageCount: number = 0;

  constructor(private _rpc: RPCService) {
    this._addresses = Observable.create(observer => this._observerAddresses = observer).publishReplay(1).refCount();

    this._rpc.register(this, 'filteraddresses', [-1], this.rpc_loadAddressCount_success, 'address');
    this._rpc.specialPoll();
  }

  getAddresses(): Observable<Array<Address>> {
    return this._addresses;
  }

  private rpc_loadAddressCount_success(response: Object): void {
    if (this.typeOfAddresses === 'receive') {
      this.addressCount = response['num_receive'];
    } else if (this.typeOfAddresses === 'send') {
      this.addressCount = response['num_send'];
      this.log.d(`rpc_loadAddressCount_success, num_send: ${this.addressCount}`);
    } else {
      this.addressCount = response['total'];
    }

    if (this.addressCount > 0) {
      this._rpc.call('filteraddresses', this.rpc_getParams())
        .subscribe(
          (success: Array<Object>) => {
            this.rpc_loadAddresses(success);
          });
    }
  }

  private rpc_getParams() {
    if (this.typeOfAddresses === 'send') {
      return [0, this.addressCount, '0', '',  '2'];
    }  else if (this.typeOfAddresses === 'receive') {
      return [0, this.addressCount, '0', '',  '1'];
    } else {
      return [0, this.addressCount, '0', ''];
    }
  }

  private rpc_loadAddresses(response: Array<Object>): void {
    let addresses: Address[] = [];
    response.forEach((resp) => addresses = this.addAddress(addresses, resp));
    this._observerAddresses.next(addresses);
  }

  // Adds an address to array from JSON object.
  private addAddress(addresses: Address[], json: Object): Address[] {
    const instance = deserialize(json, Address);

    if (typeof instance.address === 'undefined') {
      return;
    }
    addresses.unshift(instance);
    return addresses;
  }
}

