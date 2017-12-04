import { JScada, JScadaAdaptorType } from '../src/JScada'
import { spy, createFakeServer, SinonFakeServer } from 'sinon'
import { ActionType } from '../src/Actions'
import { appendSvg } from './setup'
import * as mqtt from 'mqtt/dist/mqtt.min'
import * as _ from 'lodash'
import MockWebSocket from './adaptor/MockWebSocket'

const _respondStub = {
  color: '#FFF',
  text: 'some text',
}

describe('JScada', () => {

  let server: SinonFakeServer
  let instance
  let removeSvg
  let manualSource = {
    id: 'manual-source',
    type: <JScadaAdaptorType> 'manual',
    tags: [{
        id: 'text',
        type: ActionType.text,
        projector: data => data.text,
      },
      {
        id: 'shape',
        type: ActionType.fill,
        path: 'color',
      },
    ],
  }

  let httpSource = {
    id: 'http-source',
    type: <JScadaAdaptorType> 'http',
    url: 'http://some/url',
    params: {
      interval: 100,
    },
    tags: [{
        id: 'text',
        type: ActionType.text,
        projector: data => data.text,
      },
      {
        id: 'shape',
        type: ActionType.fill,
        path: 'color',
      },
    ],
  }

  let webSocketSource = {
    id: 'ws-source',
    type: <JScadaAdaptorType> 'ws',
    url: 'ws://localhost',
    tags: [{
        id: 'text',
        type: ActionType.text,
        projector: data => data.text,
      },
      {
        id: 'shape',
        type: ActionType.fill,
        path: 'color',
      },
    ],
  }

  let mqttSource = {
    id: 'mqtt-source',
    type: <JScadaAdaptorType> 'mqtt',
    url: 'ws://localhost:3000',
    tags: [{
        id: 'text',
        type: ActionType.text,
        projector: data => data.payload.text,
      },
      {
        id: 'shape',
        type: ActionType.fill,
        path: 'payload.color',
      },
    ],
  }

  beforeEach(() => {
    removeSvg = appendSvg()
  })

  afterEach(() => {
    removeSvg()
    instance && instance.close()
  })

  it('can be constructed', () => {

    instance = new JScada({
      svg: '#svg',
      sources: [],
    })
    expect(instance.constructor === JScada).to.be.true

  })

  it('can auto start if the flag is set', () => {

    let startSpy = spy(JScada.prototype, 'start')

    let inst1 = new JScada({ svg: '#svg', sources: [] })
    expect(startSpy.calledOnce).to.be.false

    let inst2 = new JScada({
      autoStart: true,
      svg: '#svg',
      sources: [],
    })
    expect(startSpy.calledOnce).to.be.true
    inst1.close()
    inst2.close()
  })

  it('set "readyState" flag to 1 after start()', () => {

    instance = new JScada({
      svg: '#svg',
      autoStart: true,
      sources: [],
    })
    expect(instance.readyState).to.be.eq(1)

  })

  it('set "readyState" flag to 2 after suspend()', () => {

    instance = new JScada({
      svg: '#svg',
      autoStart: true,
      sources: [],
    })
    instance.suspend()
    expect(instance.readyState).to.be.eq(2)

  })

  it('set "readyState" flag to 3 after close()', () => {

    instance = new JScada({
      svg: '#svg',
      autoStart: true,
      sources: [],
    })
    instance.close()
    expect(instance.readyState).to.be.eq(3)

  })

  describe('Http Source', () => {

    beforeEach(() => {

      server = createFakeServer()
      server.respondImmediately = true
      server.respondWith(JSON.stringify(_respondStub))

    })

    afterEach(() => {
      server.restore()
    })

    it('should accept http source', () => {

      instance = new JScada({
      svg: '#svg',
      autoStart: true,
        sources: [httpSource],
      })
      expect(instance.readyState).to.be.eq(1)

    })

    it('should accept http source, update the dom correctly', (done) => {

      instance = new JScada({
        svg: '#svg',
        autoStart: true,
        sources: [httpSource],
      })
      setTimeout(function() {
        expect($('#text').text()).to.eq(_respondStub.text)
        expect($('#shape').attr('style')).to.contains('fill:' + _respondStub.color)
        done()
      }, 120)

    })

    it('should accept http source, update the dom correctly, repeatly', (done) => {

      instance = new JScada({
        svg: '#svg',
        autoStart: true,
        sources: [httpSource],
      })

      let _source = instance['_sources']['http-source']
      let count = 0
      _source.observable.subscribe(val => {
        count++
      })

      setTimeout(function() {
        expect(count).to.gte(10)
        done()
      }, 1010)

    })

    it('should accept selector instead of id in Tags, and update the dom correctly', (done) => {

      let _httpSource = _.cloneDeep(httpSource)

      _httpSource.tags[0].selector = 'text'

      instance = new JScada({
        svg: '#svg',
        autoStart: true,
        sources: [_httpSource],
      })
      setTimeout(function() {
        $('text').each((i, t) => expect($(t).text()).to.eq(_respondStub.text))
        done()
      }, 120)

    })
  })

  describe('WebSocket Source', () => {

    let _ws
    function setupMockWebSocket() {
      MockWebSocket.clearSockets()
      _ws = window.WebSocket
      window.WebSocket = MockWebSocket
    }
    function teardownMockWebSocket() {
      window.WebSocket = _ws
      MockWebSocket.clearSockets()
    }
    beforeEach(function() {
      setupMockWebSocket()
    })
    afterEach(function() {
      teardownMockWebSocket()
    })

    it('should accept websocket source', () => {

      instance = new JScada({
        svg: '#svg',
        autoStart: true,
        sources: [webSocketSource],
      })
      expect(instance.readyState).to.be.eq(1)

    })

    it('should accept websocket source, update the dom correctly', () => {

      instance = new JScada({
        svg: '#svg',
        autoStart: true,
        sources: [webSocketSource],
      })

      let socket = MockWebSocket!.lastSocket!
      socket.open()
      socket.triggerMessage(JSON.stringify(_respondStub))

      expect($('#text').text()).to.eq(_respondStub.text)
      expect($('#shape').attr('style')).to.contains('fill:' + _respondStub.color)

      socket.triggerMessage(JSON.stringify(_respondStub).replace('#FFF', '#AAA'))
      expect($('#shape').attr('style')).to.contains('fill:#AAA')

    })

  })

  describe('Mqtt Source', () => {

    const brokerUrl = 'ws://localhost:3000'
    let mqttClient

    beforeEach(() => {
      mqttClient = mqtt.connect(brokerUrl, { clientId: 'publisher' })
    })

    afterEach(() => {
      mqttClient.end(true)
    })

    it('should accept Mqtt source', () => {

      instance = new JScada({
        svg: '#svg',
        autoStart: true,
        sources: [ mqttSource ],
      })
      expect(instance.readyState).to.be.eq(1)

    })

    it('should accept Mqtt source, update the dom correctly', (done) => {

      instance = new JScada({
        svg: '#svg',
        autoStart: true,
        sources: [ mqttSource ],
      })

      // FIXME: connection may establish asynchronously, and JScada constructor doesn't consider it
      setTimeout(() => {
        mqttClient.publish('topic', JSON.stringify(_respondStub), { qos: 1 })

        setTimeout(function() {
          expect($('#text').text()).to.eq(_respondStub.text)
          expect($('#shape').attr('style')).to.contains('fill:' + _respondStub.color)
          mqttClient.publish('#', JSON.stringify(_respondStub).replace('#FFF', '#AAA'), { qos: 1 })
          done()
        }, 500)

        setTimeout(function() {
          expect($('#text').text()).to.eq(_respondStub.text)
          expect($('#shape').attr('style')).to.contains('fill:#AAA')
          done()
        }, 1000)

      }, 1000)

    }).timeout(2100)

  })

  describe('Manual source', () => {

    it ('should accept Manual source, update the dom correctly', () => {

      let inst = new JScada({
        svg: '#svg',
        autoStart: true,
        sources: [ manualSource ],
      })

      inst.feed('invalid-id', _respondStub)
      expect($('#text').text()).to.eq('')

      inst.feed('manual-source', _respondStub)
      expect($('#text').text()).to.eq(_respondStub.text)
      expect($('#shape').attr('style')).to.contains('fill:' + _respondStub.color)

      inst.close()
    })

  })

})