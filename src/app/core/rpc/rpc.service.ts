import { Injectable } from '@angular/core';
import { ElectronService } from 'ngx-electron';
import { Subject } from 'rxjs/Subject';
import { Headers, Http, Response } from '@angular/http';
import { Observable } from 'rxjs/Observable';

import { Log } from 'ng2-logger';

import { ModalsService } from '../../modals/modals.service';
import { StateService } from '../state/state.service';
import { RPXService } from './rpx.class';


const MAINNET_PORT = 51735;
const TESTNET_PORT = 51935;

const HOSTNAME = 'localhost';

/**
 * The RPC service that maintains a single connection to the particld daemon.
 *
 * It has two important functions: call and register.
 */

@Injectable()
export class RPCService {
  /**
  * IP/URL for daemon (default = localhost)
  */
  private hostname: String = HOSTNAME; // TODO: URL Flag / Settings

  /**
  * Port number of of daemon (default = 51935)
  */
  private port: number = TESTNET_PORT; // TODO: Mainnet / testnet flag...

  private username: string = 'test';
  private password: string = 'test';

  private _callOnBlock: Array<any> = [];
  private _callOnTransaction: Array<any> = [];
  private _callOnTime: Array<any> = [];
  private _callOnAddress: Array<any> = [];
  private _callOnPoll: Array<any> = [];
  private _callOnNextPoll: Array<any> = [];

  private _pollTimout: number;

  public isElectron: boolean = false;

  private log: any = Log.create('rpc.service');

  public modalUpdates: Subject<any> = new Subject<any>();

  constructor(
    private http: Http,
    public electronService: ElectronService,
    private rpx: RPXService,
    public state: StateService
  ) {
    this.isElectron = this.electronService.isElectronApp;

    // Start polling...
    this.registerStateCall('getinfo', 1000);
    this.registerStateCall('getblockchaininfo', 2000);
    this.registerStateCall('getwalletinfo', 2000);
    this.registerStateCall('getstakinginfo', 15000);

    if (this.isElectron) {

      // Respond to checks if a listener is registered
      this.rpx.rpxCall()
    }
  }


  /**
    * The call function will perform a single call to the particld daemon and perform a callback to
    * the instance through the function as defined in the params.
    *
    * @param {string} method  The JSON-RPC method to call, see ```./particld help```
    * @param {Array<Any>} params  The parameters to pass along with the JSON-RPC request.
    * The content of the array is of type any (ints, strings, booleans etc)
    *
    * @example
    * ```JavaScript
    * this._rpc.call('listtransactions', [0, 20]);
    * ```
    * TODO: Response interface
    */
  call(method: string, params?: Array<any> | null): Observable<Object> {

    if (this.isElectron) {
      return this.rpx.runCommand('backend-rpccall', null, method, params)
        .map(response => response.result);

    } else {
      const postData = JSON.stringify({
        method: method,
        params: params,
        id: 1
      }),
      headers = new Headers();

      headers.append('Content-Type', 'application/json');
      headers.append('Authorization', 'Basic ' + btoa(`${this.username}:${this.password}`));
      headers.append('Accept', 'application/json');

      return this.http
        .post(`http://${this.hostname}:${this.port}`, postData, { headers: headers })
        .map(response => response.json().result)
        .catch(error => Observable.throw(
          typeof error._body === 'object' ? error._body : JSON.parse(error._body)));
    }
  }

  stateCall(method: string, withMethod?: boolean): void {
    this.call(method)
      .subscribe(
        this.stateCallSuccess.bind(this, withMethod ? method : false),
        this.stateCallError  .bind(this, withMethod ? method : false));
  }

  registerStateCall(method: string, timeout?: number): void {
    if (timeout) {
      let first = true;
      const _call = () => {
        this.call(method)
          .subscribe(
            success => {
              this.stateCallSuccess(success);
              this.modalUpdates.next({
                response: success,
                electron: this.isElectron
              });
              setTimeout(_call, timeout);
            },
            error => {
              this.stateCallError(error);
              if (!first) {
                this.modalUpdates.next({
                  error: error.target ? error.target : error,
                  electron: this.isElectron
                });
              }
              first = false;
              setTimeout(_call, 10000);
            });
      }
      _call();
    } else {
      this.state.observe('blocks').subscribe(success => this.stateCall(method, true));
      this.state.observe('txcount').subscribe(success => this.stateCall(method, true));
    }
  }

  private stateCallSuccess(success: any, method?: string) {
    if (method) {
      const obj = {};
      obj[success] = method;
      success = obj;
    }

    Object.keys(success).forEach(key => this.state.set(key, success[key]));
  }

  private stateCallError(error: Object, method?: string) {
    this.log.er('RPC Call returned an error', error);
  }

  /**
    * The call function will perform a single call to the particld daemon and perform a callback to
    * the instance through the function as defined in the params.
    *
    * @param {Injectable} instance  The instance in which the callback functions reside.
    * @param {string} method  The JSON-RPC method to call, see ```./particld help```
    * @param {Array<Any>} params  The parameters to pass along with the JSON-RPC request.
    * The content of the array is of type any (ints, strings, booleans etc)
    * @param {Function} successCB  The function to callback (in instance) when the RPC request was successful.
    * @param {Function} errorCB  The function to callback (in instance) when the RPC request failed.
    *
    * @example
    * ```JavaScript
    * this._rpc.call(this, 'listtransactions', [0, 20], this.rpc_loadTwentyTxs_success, this.rpc_loadTwentyTxs_failed);
    * ```
    * ```JavaScript
    * rpc_loadTwentyTxs_success(json: Object) {
    *   console.log("Loaded transactions!");
    *   console.log(json);
    * }
    * ```
    */
  oldCall(
    instance: Injectable,
    method: string,
    params: Array<any> | null,
    successCB: Function,
    errorCB?: Function,
    isPoll?: boolean,
    isLast?: boolean
  ): void {
    this.call(method, params)
      .subscribe(
        response => {
          successCB.call(instance, response);
          if (isPoll && isLast) {
            this._callOnPoll.forEach((func) => func());
            this._callOnNextPoll.forEach((func) => func());
            this._callOnNextPoll = [];
          }
        },
        error => {
          if (errorCB) {
            errorCB.call(instance, error.target ? error.target : error);
          }
          this.log.er('RPC Call returned an error', error);
        });
  }

  /**
    * The register function will register a call to the particld daemon
    * which is executed whenever the trigger happens (new block, new transactions through ZMQ)
    * and performs a callback to the instance through the function as defined in the params.
    *
    * @param {Injectable} instance  The instance in which the callback functions reside.
    * @param {string} method  The JSON-RPC method to call, see ```./particld help```
    * @param {Array<Any>} params  The parameters to pass along with the JSON-RPC request.
    * The content of the array is of type any (ints, strings, booleans etc)
    * @param {Function} successCB  The function to callback (in instance) when the RPC request was successful.
    * @param {string} when  The trigger to register to: 'block' on a new block, 'tx' on a new transactions, 'address' on address changes.
    * @param {Function} errorCB  The function to callback (in instance) when the RPC request failed.
    *
    * @example
    * ```JavaScript
    * this._rpc.register(this, 'listtransactions', [0, 20],
    *   (response: Object) => {
    *     console.log("Loaded transactions!");
    *     console.log(response);
    *   }, 'block',
    *   (response: Object) => {
    *     console.log("Loaded transactions!");
    *     console.log(response);
    *   });
    * ```
    *
    * @returns      void
    */
  register(
    instance: Injectable,
    method: string,
    params: Array<any> | Function | null,
    successCB: Function,
    when: string,
    errorCB?: Function
  ): void {
    let valid = false;
    const _call = {
      instance: instance,
      method: method,
      params: params,
      successCB: successCB,
      errorCB: errorCB
    };

    if (when.indexOf('address') !== -1 || when.indexOf('both') !== -1) {
      this._callOnAddress.push(_call);
      valid = true;
    }
  }

  // TODO: Model / interface..
  private _pollCall (element: any, index: number, arr: Array<any>): void {
    this.oldCall(
      element.instance,
      element.method,
      element.params && element.params.typeOf === 'function'
      ? element.params()
      : element.params,
      element.successCB,
      element.errorCB,
      true,
      index === arr.length - 1);
  }

  /**
    * Do one poll for _address table_: execute all the registered calls.
    * Triggered from within the GUI!
    */
  specialPoll(): void {
    // A poll only for address changes, triggered from the GUI!

    this._callOnAddress.forEach(this._pollCall.bind(this));
  }
}

