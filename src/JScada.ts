import { isUndefinedOrEmpty, warn, error, debug, debugOn, pluck, getSvgDOM } from './utils'
import { HttpAdaptor, WebSocketAdaptor, MqttAdaptor, Adaptor } from './adaptor'
import { Observable, Subscription } from './modules/rxjs'
import Mounter from './Mounter'
import { ActionType } from './Actions'
import merge from 'lodash.merge'

export interface JScadaOptions {
  id?: string,
  svg: string,
  debug?: boolean,
  autoStart?: boolean,
  sources: JScadaSource[]
}

export interface JScadaSource {
  id: string,
  type: JScadaAdaptorType,
  url?: string,
  tags: JScadaTag[],
  params?: any,
}

export interface JScadaTag {
  id: string,
  selector?: string,
  type: ActionType,
  projector?: (input: any) => any,
  path?: string,
  _mounter?: Mounter,
}

export enum JScadaReadyState {
  INIT = 0,
  READY = 1,
  SUSPENDED = 2,
  CLOSED = 3,
}

export type JScadaAdaptorType = 'http' | 'ws' | 'mqtt' | 'manual'

/** Aliases */
import RS = JScadaReadyState
import ManualAdaptor from './adaptor/ManualAdaptor'
type Tag = JScadaTag
type Type = JScadaAdaptorType
type Opt = JScadaOptions

export class JScada {

  static set DEBUG(on: boolean) {
    debugOn(on)
  }

  static get DEBUG() {
    return debugOn()
  }

  private static _getAdaptor(type: Type, url?: string, params?: any) {

    params = params || {}
    switch (type) {
      case 'http':
        return new HttpAdaptor({ url: url!, headers: params.headers }, params.interval)
      case 'mqtt':
        return new MqttAdaptor(url!, params.topics || [])  // todo, topics
      case 'ws':
        return new WebSocketAdaptor(url!)
      case 'manual':
        return new ManualAdaptor()
      default:
        debug(`Use manual adaptor for ${type}:${url}`)
        return new ManualAdaptor()
    }

  }

  private _opt: Opt = {
    id: String(Math.random()).substr(2, 8),
    svg: 'body',
    autoStart: false,
    sources: [],
  }

  private _DOM = document

  private _sources = {}

  private _readyState = RS.INIT

  constructor(options: Opt) {

    merge(this._opt, options)

    if (isUndefinedOrEmpty(options.sources)) {
      warn(`No sources assigned. Nothing would happen. Option: ${JSON.stringify(this._opt)}`)
    }

    let svg = document.querySelector(this._opt.svg)

    this._DOM = getSvgDOM(svg)

    if (this._opt.autoStart) {
      debug('Auto start required, starting...')
      this.start()
    }

  }

  get readyState() {
    return this._readyState
  }

  start() {

    let { sources } = this._opt

    sources.forEach(source => {

      if (this._sources[source.id]) {
        warn(`Duplicated source id: ${source.id}`)
        return
      }
      let adaptor = JScada._getAdaptor(source.type, source.url, source.params)
      let observable = adaptor.connect()
                              .takeWhile(() => this.readyState === RS.READY)
      let subscriptions = source.tags.map(tag => this._subscribe(tag, observable))

      this._sources[source.id] = {
        adaptor,
        observable,
        subscriptions,
      }
    })

    this._readyState = RS.READY
    debug(`JScada instance ${this._opt.id} started`)
  }

  suspend() {
    // todo stub
    this._readyState = RS.SUSPENDED
  }

  close() {
    for (let s in this._sources) {
      let source = this._sources[s]
      source.adaptor.disconnect()
      source.subscriptions.forEach(sub => sub.unsubscribe())
    }
    this._readyState = RS.CLOSED
  }

  feed(sourceId: string, data: any) {
    let source = this._sources[sourceId]
    if (source && source.adaptor.constructor === ManualAdaptor ) {
      source.adaptor.feed(data)
    } else {
      warn(`No suitable source found for feeding by id ${sourceId}`)
    }
  }

  private _subscribe(tag: Tag, observable: Observable<any>): Subscription {

    debug(`Subscribe tag ${tag.id}`)
    return observable.subscribe(data => {
      if (tag._mounter === undefined) {
        tag._mounter = new Mounter(tag.id, tag.type, tag.selector, this._DOM)
      }
      try {
        data = pluck(data, tag.projector || tag.path)
      } catch (e) {
        error(e)
        return
      }
      tag._mounter.mount(data)
    })

  }

}