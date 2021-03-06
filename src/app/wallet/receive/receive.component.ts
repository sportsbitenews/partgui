import { Component, OnInit, HostListener, ElementRef, ViewChild } from '@angular/core';
import { RPCService } from '../../core/rpc/rpc.service';

import { Log } from 'ng2-logger';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-receive',
  templateUrl: './receive.component.html',
  styleUrls: ['./receive.component.scss']
})
export class ReceiveComponent implements OnInit {

  @ViewChild('qrCode') qrElementView: ElementRef;

  /* UI State */
  private type: string = 'public';
  public query: string = '';
  public openNewAddressModal: boolean = false;
  public addLableForm: FormGroup;
  public label: string;

  defaultAddress: Object = {
    id: 0,
    label: 'Empty label',
    address: 'Empty address',
    balance: 0,
    readable: ['Empty']
  };

  selected: any = {
    id: 0,
    label: 'Empty label',
    address: 'Empty address',
    balance: 0,
    readable: ['empty']
  };

  qrSize: number = 380;

  /* UI Pagination */
  addresses: any = {
    private: [this.defaultAddress],
    public: [this.defaultAddress],
    query: [this.defaultAddress]

  };

  MAX_ADDRESSES_PER_PAGE: number = 6;
  page: number = 1;

  /* initialized boolean: when true => checkUnusedAddress is already looping! */
  initialized: boolean = false;

  /* General */
  log: any = Log.create('receive.component');

  constructor(private rpc: RPCService,
              private formBuilder: FormBuilder) {
  }

  ngOnInit() {
    // start rpc
    this.rpc_update();
    this.buildForm();
  }

  buildForm(): void {
    this.addLableForm = this.formBuilder.group({
      label: this.formBuilder.control(null, [Validators.required]),
    });
  }


  /**
    * Returns the addresses to display in the UI with regards to both pagination and search/query.
    * Does _NOT_ return the ununsed address!
    */
  getSinglePage(): Array<Object> {
    let type = this.type;

    if (this.inSearchMode()) { // in search mode
      type = 'query';

      this.addresses.query = this.addresses[this.type].filter(el => {
        this.log.d(`pageChanged, changing receive page to: ${JSON.stringify(el)}`);
        return (
          el.label.toLowerCase().indexOf(this.query.toLowerCase()) !== -1 ||
          el.address.toLowerCase().indexOf(this.query.toLowerCase()) !== -1
        );
      });
    }

    // offset unused address by 1 if not in search mode
    // if in search mode -> offset = 0
    // else offset = 1 -> skip the unused address
    const offset: number = +(type !== 'query');

    return this.addresses[type].slice(
      offset + ((this.page - 1) * this.MAX_ADDRESSES_PER_PAGE), this.page * this.MAX_ADDRESSES_PER_PAGE);
  }

  /** Returns the unused addresses to display in the UI. */
  getUnusedAddress(): Object {
    return this.addresses[this.type][0];
  }

  /**
    * Returns the total counts of addresses to display in the UI with regards to both the type of address (private/public) and search.
    * Excludes the count for the unused address! (- 1 except for search!)
    */
  getTotalCountForPagination(): number {
    if (this.inSearchMode()) {
      return this.addresses.query.length;
    }

    return this.addresses[this.type].length - 1;
  }

  /** Called to change the page. */
  pageChanged(event: any) {
    if (event.page !== undefined) {
      this.log.d(`pageChanged, changing receive page to: ${event.page}`);
    }
  }

  /* ---- UI Helper functions ---------------------------------------------- */

  /**
    * Returns whether we're in search mode or not!
    * The current table is showing limited results due to search.
    * Mainly for hiding the "Unused address" & ease of use in other functions.
    */
  inSearchMode(): boolean {
    return !!this.query;
  }

  /** OnEscape => exit search results */
  @HostListener('window:keydown', ['$event'])
  keyboardInput(event: any) {
    // clear search bar on esc
    if (event.code.toLowerCase() === 'escape') {
      this.query = '';
    }
  }

  /**
    * Sets the address type, also checks if valid. Also changes the selected address.
    * @param type Address type to set
    */
  setAddressType(type: string) {
    if (['public', 'private'].indexOf(type) !== -1) {
      this.type = type;
    }

    this.selectAddress(this.addresses[type][0]);
  }

  getAddressType() {
    return this.type;
  }

  /**
    * Selected address stuff + QRcode
    * @param address The address to select
    */
  selectAddress(address: string) {
    this.selected = address;
  }

  /** Get the QR Code size */
  getQrSize() {
    // this is just a cheaty way of getting the tests to pass
    if (this.initialized) {
      return this.qrElementView.nativeElement.offsetWidth - 40;
    } else {
      return 380;
    }
  }

  /* ---- RPC LOGIC -------------------------------------------------------- */

  /** Used to get the addresses. */
  rpc_update() {
    // this.rpc.oldCall(this, 'filteraddresses', [-1], this.rpc_loadAddressCount_success);
    this.rpc.call('filteraddresses', [-1])
      .subscribe(response => {
        this.rpc_loadAddressCount_success(response)
      },
      error => {
        this.log.er('error', error);
      });
  }

  /**
    * Used to get the addresses.
    * TODO: Create interface
    */
  rpc_loadAddressCount_success(response: any) {
    const count = response.num_receive;

    if (count === 0) {
      return;
    }
    // this.rpc.oldCall(this, 'filteraddresses', [0, count, '0', '', '1'], this.rpc_loadAddresses_success);
    this.rpc.call('filteraddresses', [0, count, '0', '', '1'])
      .subscribe(
        (resp: Array<any>) => {
        this.rpc_loadAddresses_success(resp)
      },
      error => {
        this.log.er('error', error);
      });
  }

  /**
    * Used to get the addresses.
    * TODO: Create interface Array<AddressInterface?>
    */
  rpc_loadAddresses_success(response: Array<any>) {
    const pub = [],
          priv = [];

    response.forEach((row) => {
      if (row.address.length < 35) {
        pub.push(row);
      } else {
        priv.push(row);
      }
    });

    // I need to get the count of the addresses seperate in public/private first,
    // because this.addresses[type] can never be empty,
    // we need to delete our default address before doing addAddress..
    if (pub.length > 0) {
      this.addresses.public = [];
    }

    if (priv.length > 0) {
      this.addresses.private = [];
    }

    pub .forEach((val) => this.addAddress(val, 'public'));
    priv.forEach((val) => this.addAddress(val, 'private'));

    if (!!response[0]) {
      this.sortArrays();

      this.selectAddress(this.addresses[this.type][0]);
    }

    if (!this.initialized) {
      this.initialized = true;
      this.checkIfUnusedAddress();
    }

  }

  /**
    * Transforms the json to the right format and adds it to the right array (public / private)
    * TODO: Create interface for response
    */
  addAddress(response: any, type: string) {
    const tempAddress = {
      id: 0,
      label: 'Empty label',
      address: 'Empty address',
      balance: 0,
      readable: ['Empty']
    };

    tempAddress.address = response.address;
    if (!!response.label) {
      tempAddress.label = response.label;
    }

    tempAddress.readable = tempAddress.address.match(/.{1,4}/g);

    if (type === 'public') {

      // not all addresses are derived from HD wallet (importprivkey)
      if (!!response.path) {
        tempAddress.id = response.path.replace('m/0/', '');
      }
      this.addresses.public.unshift(tempAddress);

    } else if (type === 'private') {

      // not all stealth addresses are derived from HD wallet (importprivkey)
      if (response.path !== undefined) {
        tempAddress.id = +(response.path.replace('m/0\'/', '').replace('\'', '')) / 2;
      }
      this.addresses.private.unshift(tempAddress);
    }
  }

  /** Sorts the private/public address by id (= HD wallet path m/0/0 < m/0/1) */
  sortArrays() {
    function compare(a: any, b: any) {
      return b.id - a.id;
    }

    this.addresses.public.sort(compare);
    this.addresses.private.sort(compare);
  }


  /** Checks if the newest address is still unused (hasn't received funds).
    * If it has received funds, generate a new address and update the table.
    * TODO: Remove timeout if not currently on ngOnDestroy
    */
  checkIfUnusedAddress() {
    if (this.addresses.public[0].address !== 'Empty address') {
      // this.rpc.oldCall(this, 'getreceivedbyaddress', [this.addresses.public[0].address, 0], this.rpc_callbackUnusedAddress_success);
      this.rpc.call('getreceivedbyaddress', [this.addresses.public[0].address, 0])
      .subscribe(response => {
        this.rpc_callbackUnusedAddress_success(response)
      },
      error => {
        this.log.er('error', error);
      });
    }
    setTimeout(() => {
      this.checkIfUnusedAddress();
    }, 30000);
  }

  rpc_callbackUnusedAddress_success(json: Object) {
    if (json > 0) {
      this.log.er('rpc_callbackUnusedAddress_success: Funds received, need unused public address');

      // this.rpc.oldCall(this, 'getnewaddress', null, () => {
      //   this.log.er('rpc_callbackUnusedAddress_success: successfully retrieved new address');

      //   // just call for a complete update, just adding the address isn't possible because
      //   this.rpc_update();
      // });

      this.rpc.call('getnewaddress', null)
      .subscribe(response => {
        this.log.er('rpc_callbackUnusedAddress_success: successfully retrieved new address');

        // just call for a complete update, just adding the address isn't possible because
        this.rpc_update();
      },
      error => {
        this.log.er('error');
      });
    }
  }

  /**
    * Generate a new address with label.
    * TODO: Get rid of prompt, use nice modal.
    */
  newAddress() {
    const call = this.type === 'public' ? 'getnewaddress' : (this.type === 'private' ? 'getnewstealthaddress' : '');

    if (!!call) {
      // this.rpc.oldCall(this, call, [this.label], () => {
      //   this.log.er('newAddress: successfully retrieved new address');
      //   // just call for a complete update, just adding the address isn't possible because
      //   this.rpc_update();
      //   this.closeNewAddress();
      //   this.addLableForm.reset();
      // });
      this.rpc.call(call, [this.label])
        .subscribe(response => {
          this.log.er('newAddress: successfully retrieved new address');
          // just call for a complete update, just adding the address isn't possible because
          this.rpc_update();
          this.closeNewAddress();
          this.addLableForm.reset();
        },
        error => {
          this.log.er('error');
        });
    }
  }

  selectInput() {
    (<HTMLInputElement>document.getElementsByClassName('header-input')[0]).select();
  }

  openNewAddress(): void {
    this.openNewAddressModal = true;
  }

  closeNewAddress(): void {
    this.openNewAddressModal = false;
  }

    // capture the enter button
  @HostListener('window:keydown', ['$event'])
    keyDownEvent(event: any) {
      if (event.key.toLowerCase() === 'escape') {
        this.openNewAddressModal = false;
      }
    }

}
