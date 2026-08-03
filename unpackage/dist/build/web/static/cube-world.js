(function (global) {
  'use strict'

  var THREE = global.THREE
  var runtime = null

  var GRID = 1.16
  var CUBE_SIZE = GRID
  var FLOOR_TOP = 0.18
  var LEVEL_HEIGHT = 1.16
  var WATER_Y = -0.72
  var WATER_BOTTOM_Y = -1.64
  var MOVE_MS = 340
  var LEVEL_MOVE_MS = 680
  var REPEAT_GAP_MS = 24
  var AUDIO_MASTER_GAIN = 3
  var CUBE_TEXTURE_URL = '/static/image/cube/cube-atlas.png'
  var CAMERA_X = 7.8
  var CAMERA_Y = 13
  var CAMERA_Z = 13.5

  var entries = [
    { id: 'games', name: '游戏经历', desc: '游戏经历、游玩记录与灵感收藏', x: -6, z: 1, level: 0, color: 0xe77f9f, facing: Math.PI, route: '/pages/games/index' },
    { id: 'qiyu', name: '千星奇域', desc: '进入千星奇域项目与关卡展示', x: 7, z: 0, level: 0, color: 0x52b9ca, facing: -Math.PI / 2, route: '/pages/section/index?sectionId=qianxingqiyu' },
    { id: 'digital', name: '数码DIY', desc: '硬件、数码与装机记录', x: -5, z: 4, level: 0, color: 0x7b82c7, facing: Math.PI, route: '/pages/digital/index' },
    { id: 'favorite', name: 'Kiana', desc: '角色、记忆与喜欢的事物', x: 2, z: -5, level: 1, color: 0x9b75bd, facing: 0, route: '/pages/favorite/index' },
    { id: 'profile', name: '个人档案', desc: '关于我与联系方式', x: 5, z: 4, level: 0, color: 0xe5b85e, facing: Math.PI, route: '/pages/about/index' }
  ]

  // A long main road, two ground branches, and a raised loop with a drop.
  var pathCells = [
    { x: -6, z: 0, level: 0 }, { x: -5, z: 0, level: 0 }, { x: -4, z: 0, level: 0 },
    { x: -3, z: 0, level: 0 }, { x: -2, z: 0, level: 0 }, { x: -1, z: 0, level: 0 },
    { x: 0, z: 0, level: 0 }, { x: 1, z: 0, level: 0 }, { x: 2, z: 0, level: 0 },
    { x: 3, z: 0, level: 0 }, { x: 4, z: 0, level: 0 }, { x: 5, z: 0, level: 0 }, { x: 6, z: 0, level: 0 },
    { x: -3, z: 1, level: 0 }, { x: -3, z: 2, level: 0 }, { x: -3, z: 3, level: 0 },
    { x: -4, z: 3, level: 0 }, { x: -5, z: 3, level: 0 },
    { x: 3, z: 1, level: 0 }, { x: 3, z: 2, level: 0 }, { x: 3, z: 3, level: 0 },
    { x: 4, z: 3, level: 0 }, { x: 5, z: 3, level: 0 },
    { x: 0, z: -1, level: 0 }, { x: 0, z: -2, level: 1 },
    { x: 1, z: -2, level: 1 }, { x: 2, z: -2, level: 1 }, { x: 2, z: -3, level: 1 },
    { x: 2, z: -4, level: 1 },
    { x: 3, z: -3, level: 1 }, { x: 3, z: -2, level: 0 },
    { x: 4, z: -2, level: 0 }, { x: 5, z: -2, level: 0 }
  ]
  var cellHeights = {}
  for (var pathIndex = 0; pathIndex < pathCells.length; pathIndex += 1) {
    cellHeights[pathCells[pathIndex].x + ',' + pathCells[pathIndex].z] = pathCells[pathIndex].level
  }
  var blocked = new Set()

  function floorY(level) {
    return FLOOR_TOP + level * LEVEL_HEIGHT
  }

  function waterHeightAt(x, z, elapsed) {
    return WATER_Y + Math.sin(elapsed * 0.86 + x * 0.48 + z * 0.32) * 0.058
      + Math.cos(elapsed * 0.6 + z * 0.62 - x * 0.2) * 0.034
  }

  function getCellLevel(x, z) {
    var value = cellHeights[x + ',' + z]
    return value === undefined ? null : value
  }

  function addStyles() {
    if (document.getElementById('cube-world-styles')) return
    var style = document.createElement('style')
    style.id = 'cube-world-styles'
    style.textContent = `
      #cube-world { position: relative; overflow: hidden; font-family: Inter, "PingFang SC", "Microsoft YaHei", sans-serif; color: #13211f; }
      #cube-world * { box-sizing: border-box; letter-spacing: 0; }
      .cube-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; }
      .cube-vignette { position: absolute; inset: 0; pointer-events: none; box-shadow: inset 0 0 150px rgba(20, 38, 48, .22); }
      .cube-brand { position: absolute; left: 28px; top: 24px; z-index: 4; pointer-events: none; }
      .cube-brand-kicker { display: block; color: #227a70; font-size: 11px; line-height: 16px; font-weight: 800; }
      .cube-brand-title { display: block; margin-top: 4px; color: #10201d; font-size: 25px; line-height: 32px; font-weight: 800; }
      .cube-brand-sub { display: block; margin-top: 5px; color: #5c6d69; font-size: 12px; line-height: 18px; }
      .cube-hud button { height: 36px; border: 1px solid rgba(26, 51, 47, .16); border-radius: 6px; background: rgba(255,255,255,.88); color: #14231f; padding: 0 13px; font: 700 13px/34px inherit; cursor: pointer; box-shadow: 0 8px 22px rgba(27, 52, 48, .08); }
      .cube-hud button:hover { background: #fff; border-color: rgba(34, 122, 112, .48); }
      .world-label { position: absolute; z-index: 3; transform: translate(-50%, -100%); pointer-events: none; text-align: center; transition: opacity .18s, transform .18s; }
      .world-label-name { display: inline-block; min-width: 76px; padding: 5px 8px; border: 1px solid rgba(22, 43, 39, .16); border-radius: 5px; background: rgba(255,255,255,.9); color: #13211f; font-size: 12px; line-height: 16px; font-weight: 800; box-shadow: 0 8px 20px rgba(25, 48, 44, .12); }
      .world-label.active { transform: translate(-50%, calc(-100% - 8px)); }
      .world-label.active .world-label-name { color: #fff; background: #176b61; border-color: #176b61; box-shadow: 0 0 0 4px rgba(81, 214, 194, .22), 0 10px 24px rgba(21, 92, 83, .24); }
      .cube-hud { position: absolute; right: 26px; top: 24px; z-index: 5; width: min(344px, calc(100vw - 72px)); padding: 16px; border: 1px solid rgba(25, 50, 46, .15); border-radius: 8px; background: rgba(252,255,254,.9); box-shadow: 0 18px 42px rgba(28, 52, 48, .15); backdrop-filter: blur(12px); }
      .cube-hud-state { display: block; color: #227a70; font-size: 11px; line-height: 16px; font-weight: 800; }
      .cube-hud-title { display: block; margin-top: 4px; color: #10201d; font-size: 19px; line-height: 26px; font-weight: 800; }
      .cube-hud-desc { display: block; margin-top: 3px; color: #5a6966; font-size: 12px; line-height: 18px; }
      .cube-hud-actions { display: flex; gap: 8px; margin-top: 12px; }
      .cube-hud .enter-button { color: #fff; background: #176b61; border-color: #176b61; }
      .cube-hud .enter-button:disabled { color: #788581; background: #dde4e2; border-color: #d0d9d6; cursor: default; }
      .cube-toast { position: absolute; left: 50%; top: 20%; z-index: 7; transform: translate(-50%, -12px); opacity: 0; padding: 8px 12px; border-radius: 6px; color: #fff; background: rgba(18, 35, 32, .86); font-size: 12px; line-height: 18px; transition: opacity .18s, transform .18s; pointer-events: none; }
      .cube-toast.show { opacity: 1; transform: translate(-50%, 0); }
      .cube-audio-toggle { position: absolute; right: 26px; bottom: 24px; z-index: 6; width: 42px; height: 42px; padding: 0; border: 1px solid rgba(25, 50, 46, .18); border-radius: 6px; background: rgba(252,255,254,.88); box-shadow: 4px 5px 0 rgba(53, 101, 92, .13), 0 12px 28px rgba(28, 52, 48, .12); cursor: pointer; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px); transition: transform .16s, background .16s, box-shadow .16s; }
      .cube-audio-toggle:hover { transform: translateY(-2px); background: #fff; box-shadow: 5px 7px 0 rgba(53, 101, 92, .14), 0 14px 30px rgba(28, 52, 48, .14); }
      .cube-audio-toggle:active { transform: translateY(1px); box-shadow: 2px 2px 0 rgba(53, 101, 92, .12); }
      .cube-audio-icon { position: relative; width: 9px; height: 12px; margin-left: -7px; border-radius: 2px; background: #28796f; }
      .cube-audio-icon::before { content: ''; position: absolute; left: 5px; top: -4px; width: 0; height: 0; border-top: 10px solid transparent; border-bottom: 10px solid transparent; border-left: 0; border-right: 12px solid #28796f; }
      .cube-audio-icon::after { content: ''; position: absolute; left: 17px; top: -5px; width: 10px; height: 18px; border-right: 2px solid #28796f; border-radius: 50%; }
      .cube-audio-toggle.muted .cube-audio-icon { background: #899793; }
      .cube-audio-toggle.muted .cube-audio-icon::before { border-right-color: #899793; }
      .cube-audio-toggle.muted .cube-audio-icon::after { left: 12px; top: 5px; width: 18px; height: 2px; border: 0; border-radius: 0; background: #c97980; transform: rotate(-45deg); }
      @media (max-width: 760px) {
        .cube-brand { display: none; }
        .cube-hud { right: 12px; top: 12px; width: min(276px, calc(100vw - 68px)); min-width: 155px; padding: 12px; }
        .cube-hud-title { font-size: 16px; line-height: 22px; }
        .cube-hud-desc { display: none; }
        .cube-hud-actions { margin-top: 8px; }
        .cube-hud button { height: 32px; padding: 0 9px; font-size: 11px; line-height: 30px; }
        .world-label-name { min-width: 62px; padding: 4px 6px; font-size: 10px; line-height: 14px; }
        .cube-audio-toggle { right: 12px; bottom: 12px; width: 38px; height: 38px; }
      }
    `
    document.head.appendChild(style)
  }

  function route(path) {
    global.location.hash = '#' + path
  }

  function applyCubeAtlasUv(geometry) {
    var faceTiles = [
      [2, 1], // right
      [0, 1], // left
      [1, 0], // top
      [1, 2], // bottom
      [1, 1], // front
      [3, 1] // back
    ]
    var uv = geometry.attributes.uv
    var index = geometry.index
    var inset = 2 / 256
    for (var faceIndex = 0; faceIndex < geometry.groups.length; faceIndex += 1) {
      var group = geometry.groups[faceIndex]
      var tile = faceTiles[faceIndex]
      var visited = {}
      for (var offset = group.start; offset < group.start + group.count; offset += 1) {
        var vertexIndex = index.getX(offset)
        if (visited[vertexIndex]) continue
        visited[vertexIndex] = true
        var localU = inset + uv.getX(vertexIndex) * (1 - inset * 2)
        var localV = inset + uv.getY(vertexIndex) * (1 - inset * 2)
        uv.setXY(
          vertexIndex,
          (tile[0] + localU) / 4,
          1 - (tile[1] + 1 - localV) / 3
        )
      }
    }
    uv.needsUpdate = true
    geometry.clearGroups()
    geometry.addGroup(0, index.count, 0)
  }

  function makeCube(renderer) {
    var geometry = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE)
    applyCubeAtlasUv(geometry)
    var material = new THREE.MeshStandardMaterial({
      color: 0xf1f7f3,
      roughness: 0.42,
      metalness: 0.03
    })
    var mesh = new THREE.Mesh(geometry, material)
    new THREE.TextureLoader().load(CUBE_TEXTURE_URL, function (texture) {
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
      material.color.setHex(0xffffff)
      material.map = texture
      material.needsUpdate = true
    })
    mesh.castShadow = true
    mesh.receiveShadow = true

    var edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.86 })
    )
    mesh.add(edges)
    return mesh
  }

  function createChamferedPrism(width, height, corner) {
    var half = width / 2
    var shape = new THREE.Shape()
    shape.moveTo(-half + corner, -half)
    shape.lineTo(half - corner, -half)
    shape.lineTo(half, -half + corner)
    shape.lineTo(half, half - corner)
    shape.lineTo(half - corner, half)
    shape.lineTo(-half + corner, half)
    shape.lineTo(-half, half - corner)
    shape.lineTo(-half, -half + corner)
    shape.closePath()
    var geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false })
    geometry.rotateX(-Math.PI / 2)
    geometry.computeVertexNormals()
    return geometry
  }

  function createArchGeometry(width, height) {
    var radius = width / 2
    var springY = height - radius
    var shape = new THREE.Shape()
    shape.moveTo(-radius, 0)
    shape.lineTo(radius, 0)
    shape.lineTo(radius, springY)
    shape.absarc(0, springY, radius, 0, Math.PI, false)
    shape.lineTo(-radius, 0)
    return new THREE.ShapeGeometry(shape, 8)
  }

  function createShorelineGeometry(innerRadius, outerRadius, segments, seed) {
    var positions = []
    var indices = []
    var amplitude = Math.min(0.032, (outerRadius - innerRadius) * 0.3)
    for (var i = 0; i < segments; i += 1) {
      var angle = i / segments * Math.PI * 2
      var irregularity = Math.sin(i * 1.73 + seed) * amplitude + Math.cos(i * 2.91 + seed * 0.7) * amplitude * 0.45
      var outer = outerRadius + irregularity
      positions.push(Math.cos(angle) * innerRadius, 0, Math.sin(angle) * innerRadius)
      positions.push(Math.cos(angle) * outer, 0, Math.sin(angle) * outer)
    }
    for (var segment = 0; segment < segments; segment += 1) {
      var next = (segment + 1) % segments
      var inner = segment * 2
      var outerIndex = inner + 1
      var nextInner = next * 2
      var nextOuter = nextInner + 1
      indices.push(inner, outerIndex, nextOuter, inner, nextOuter, nextInner)
    }
    var geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    return geometry
  }

  function createMeshShorelineGeometry(mesh, planeY, width, centerX, centerZ) {
    mesh.updateWorldMatrix(true, false)
    var source = mesh.geometry.attributes.position
    var index = mesh.geometry.index
    var points = []
    var triangleCount = index ? index.count / 3 : source.count / 3
    var vertices = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]

    function addPoint(point) {
      for (var existing = 0; existing < points.length; existing += 1) {
        var dx = points[existing].x - point.x
        var dz = points[existing].z - point.z
        if (dx * dx + dz * dz < 0.0004) return
      }
      points.push(new THREE.Vector2(point.x, point.z))
    }

    for (var triangle = 0; triangle < triangleCount; triangle += 1) {
      for (var corner = 0; corner < 3; corner += 1) {
        var vertexIndex = index ? index.getX(triangle * 3 + corner) : triangle * 3 + corner
        vertices[corner].fromBufferAttribute(source, vertexIndex).applyMatrix4(mesh.matrixWorld)
      }
      for (var edge = 0; edge < 3; edge += 1) {
        var a = vertices[edge]
        var b = vertices[(edge + 1) % 3]
        var ay = a.y - planeY
        var by = b.y - planeY
        if (ay * by > 0 || Math.abs(a.y - b.y) < 0.00001) continue
        var t = (planeY - a.y) / (b.y - a.y)
        if (t < 0 || t > 1) continue
        addPoint(new THREE.Vector3().lerpVectors(a, b, t))
      }
    }

    if (points.length < 3) return createShorelineGeometry(0.5, 0.5 + width, 16, 0)
    points.sort(function (a, b) {
      return Math.atan2(a.y - centerZ, a.x - centerX) - Math.atan2(b.y - centerZ, b.x - centerX)
    })

    var positions = []
    var indices = []
    for (var pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
      var px = points[pointIndex].x - centerX
      var pz = points[pointIndex].y - centerZ
      var length = Math.max(0.001, Math.sqrt(px * px + pz * pz))
      positions.push(px - px / length * 0.012, 0, pz - pz / length * 0.012)
      positions.push(px + px / length * width, 0, pz + pz / length * width)
    }
    for (var contourIndex = 0; contourIndex < points.length; contourIndex += 1) {
      var contourNext = (contourIndex + 1) % points.length
      var contourInner = contourIndex * 2
      var contourOuter = contourInner + 1
      var contourNextInner = contourNext * 2
      var contourNextOuter = contourNextInner + 1
      indices.push(contourInner, contourOuter, contourNextOuter, contourInner, contourNextOuter, contourNextInner)
    }
    var geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    return geometry
  }

  function World(host) {
    this.host = host
    this.host.innerHTML = ''
    this.destroyed = false
    this.player = { x: 0, z: 0, level: 0 }
    this.activeEntry = null
    this.movement = null
    this.heldMovement = null
    this.repeatTimer = 0
    this.audioState = null
    this.audioEnabled = true
    try {
      this.audioEnabled = global.localStorage.getItem('cube-world-audio') !== 'off'
    } catch (error) {}
    this.labelNodes = []
    this.clock = new THREE.Clock()
    this.cameraFocus = new THREE.Vector3(0, 0, 0)
    this.cameraTarget = new THREE.Vector3(0, 0, 0)
    this.raf = 0
    this.toastTimer = 0
    this.routeTimer = 0

    addStyles()
    this.createUi()
    this.createScene()
    this.bindEvents()
    this.resize()
    this.updateEntryState()
    this.animate()
  }

  World.prototype.createUi = function () {
    var ui = document.createElement('div')
    ui.innerHTML = `
      <div class="cube-vignette"></div>
      <div class="cube-brand">
        <span class="cube-brand-kicker">CUBE NAVIGATION / 3D</span>
        <span class="cube-brand-title">无边的个人空间</span>
        <span class="cube-brand-sub">让小方块翻滚到建筑门前，再确认进入</span>
      </div>
      <section class="cube-hud" aria-live="polite">
        <span class="cube-hud-state">探索模式</span>
        <span class="cube-hud-title">移动到建筑门前</span>
        <span class="cube-hud-desc">沿石桥翻滚，在高低层交界处上翻或下落。</span>
        <div class="cube-hud-actions">
          <button class="enter-button" type="button" disabled>进入</button>
          <button type="button" data-route="/pages/section/index?sectionId=qianxingqiyu">直接浏览</button>
        </div>
      </section>
      <button class="cube-audio-toggle" type="button" title="关闭声音" aria-label="关闭声音">
        <span class="cube-audio-icon" aria-hidden="true"></span>
      </button>
      <div class="cube-toast"></div>
    `
    this.host.appendChild(ui)
    this.ui = ui
    this.hudState = ui.querySelector('.cube-hud-state')
    this.hudTitle = ui.querySelector('.cube-hud-title')
    this.hudDesc = ui.querySelector('.cube-hud-desc')
    this.enterButton = ui.querySelector('.enter-button')
    this.audioButton = ui.querySelector('.cube-audio-toggle')
    this.toast = ui.querySelector('.cube-toast')
    this.updateAudioButton()
  }

  World.prototype.updateAudioButton = function () {
    if (!this.audioButton) return
    this.audioButton.classList.toggle('muted', !this.audioEnabled)
    var label = this.audioEnabled ? '关闭声音' : '开启声音'
    this.audioButton.title = label
    this.audioButton.setAttribute('aria-label', label)
  }

  World.prototype.scheduleTone = function (destination, frequency, start, duration, volume, type, endFrequency, attack) {
    if (!this.audioState) return
    var context = this.audioState.context
    var oscillator = context.createOscillator()
    var gain = context.createGain()
    var toneAttack = attack === undefined ? 0.012 : attack
    oscillator.type = type || 'sine'
    oscillator.frequency.setValueAtTime(frequency, start)
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.linearRampToValueAtTime(volume, start + toneAttack)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    oscillator.connect(gain)
    gain.connect(destination)
    oscillator.start(start)
    oscillator.stop(start + duration + 0.04)
  }

  World.prototype.scheduleAmbientChord = function () {
    if (!this.audioState || this.destroyed) return
    var state = this.audioState
    var chords = [
      [146.83, 220, 293.66],
      [164.81, 246.94, 329.63],
      [130.81, 196, 261.63],
      [146.83, 220, 329.63]
    ]
    var chord = chords[state.chordIndex % chords.length]
    var start = state.context.currentTime + 0.05
    for (var i = 0; i < chord.length; i += 1) {
      this.scheduleTone(state.musicGain, chord[i], start + i * 0.06, 6.2, 0.026, 'sine', 0, 1.35)
    }
    this.scheduleTone(state.musicGain, chord[2] * 2, start + 1.7, 3.4, 0.008, 'sine', 0, 0.65)
    state.chordIndex += 1
  }

  World.prototype.startAmbient = function () {
    if (!this.audioState || this.audioState.ambientTimer) return
    var state = this.audioState
    var noise = state.context.createBufferSource()
    var filter = state.context.createBiquadFilter()
    var noiseGain = state.context.createGain()
    noise.buffer = state.noiseBuffer
    noise.loop = true
    filter.type = 'lowpass'
    filter.frequency.value = 420
    noiseGain.gain.value = 0.012
    noise.connect(filter)
    filter.connect(noiseGain)
    noiseGain.connect(state.musicGain)
    noise.start()
    state.ambientNoise = noise
    this.scheduleAmbientChord()
    var self = this
    state.ambientTimer = global.setInterval(function () { self.scheduleAmbientChord() }, 4800)
  }

  World.prototype.ensureAudio = function () {
    if (!this.audioEnabled) return null
    if (this.audioState) {
      if (this.audioState.context.state === 'suspended') this.audioState.context.resume()
      this.audioState.masterGain.gain.setTargetAtTime(AUDIO_MASTER_GAIN, this.audioState.context.currentTime, 0.08)
      return this.audioState
    }
    var AudioContextClass = global.AudioContext || global.webkitAudioContext
    if (!AudioContextClass) return null
    var context = new AudioContextClass()
    var masterGain = context.createGain()
    var musicGain = context.createGain()
    var sfxGain = context.createGain()
    var limiter = context.createDynamicsCompressor()
    masterGain.gain.value = AUDIO_MASTER_GAIN
    musicGain.gain.value = 0.72
    sfxGain.gain.value = 0.58
    limiter.threshold.value = -7
    limiter.knee.value = 5
    limiter.ratio.value = 8
    limiter.attack.value = 0.004
    limiter.release.value = 0.22
    musicGain.connect(masterGain)
    sfxGain.connect(masterGain)
    masterGain.connect(limiter)
    limiter.connect(context.destination)

    var noiseBuffer = context.createBuffer(1, Math.floor(context.sampleRate * 1.5), context.sampleRate)
    var noiseData = noiseBuffer.getChannelData(0)
    for (var i = 0; i < noiseData.length; i += 1) {
      noiseData[i] = Math.random() * 2 - 1
    }
    this.audioState = {
      context: context,
      masterGain: masterGain,
      limiter: limiter,
      musicGain: musicGain,
      sfxGain: sfxGain,
      noiseBuffer: noiseBuffer,
      chordIndex: 0,
      ambientTimer: 0,
      ambientNoise: null
    }
    this.startAmbient()
    return this.audioState
  }

  World.prototype.playNoiseBurst = function (frequency, duration, volume) {
    var state = this.audioState
    if (!state || !this.audioEnabled) return
    var start = state.context.currentTime
    var source = state.context.createBufferSource()
    var filter = state.context.createBiquadFilter()
    var gain = state.context.createGain()
    source.buffer = state.noiseBuffer
    filter.type = 'bandpass'
    filter.frequency.value = frequency
    filter.Q.value = 0.8
    gain.gain.setValueAtTime(volume, start)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(state.sfxGain)
    source.start(start)
    source.stop(start + duration)
  }

  World.prototype.playSfx = function (name) {
    var state = this.ensureAudio()
    if (!state || !this.audioEnabled) return
    var now = state.context.currentTime
    if (name === 'roll') {
      this.scheduleTone(state.sfxGain, 145, now, 0.14, 0.07, 'triangle', 92)
      this.playNoiseBurst(620, 0.09, 0.045)
    } else if (name === 'blocked') {
      this.scheduleTone(state.sfxGain, 104, now, 0.22, 0.075, 'triangle', 68)
      this.playNoiseBurst(280, 0.07, 0.035)
    } else if (name === 'up') {
      this.scheduleTone(state.sfxGain, 293.66, now, 0.42, 0.048, 'sine')
      this.scheduleTone(state.sfxGain, 392, now + 0.09, 0.48, 0.044, 'sine')
      this.scheduleTone(state.sfxGain, 493.88, now + 0.18, 0.56, 0.04, 'sine')
    } else if (name === 'down') {
      this.scheduleTone(state.sfxGain, 392, now, 0.36, 0.046, 'sine')
      this.scheduleTone(state.sfxGain, 293.66, now + 0.08, 0.42, 0.043, 'sine')
      this.scheduleTone(state.sfxGain, 196, now + 0.16, 0.5, 0.04, 'sine')
    } else if (name === 'entry') {
      this.scheduleTone(state.sfxGain, 392, now, 0.7, 0.034, 'sine')
      this.scheduleTone(state.sfxGain, 493.88, now + 0.12, 0.78, 0.032, 'sine')
      this.scheduleTone(state.sfxGain, 659.25, now + 0.25, 0.9, 0.028, 'sine')
    } else if (name === 'confirm') {
      this.scheduleTone(state.sfxGain, 523.25, now, 0.45, 0.05, 'sine')
      this.scheduleTone(state.sfxGain, 783.99, now + 0.08, 0.62, 0.045, 'sine')
    }
  }

  World.prototype.toggleAudio = function () {
    this.audioEnabled = !this.audioEnabled
    try {
      global.localStorage.setItem('cube-world-audio', this.audioEnabled ? 'on' : 'off')
    } catch (error) {}
    if (this.audioEnabled) {
      this.ensureAudio()
    } else if (this.audioState) {
      this.audioState.masterGain.gain.setTargetAtTime(0.0001, this.audioState.context.currentTime, 0.06)
    }
    this.updateAudioButton()
  }

  World.prototype.createScene = function () {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0xbfdad8)
    this.scene.fog = new THREE.Fog(0xbfdad8, 18, 34)

    this.camera = new THREE.OrthographicCamera(-7, 7, 5, -5, 0.1, 60)
    this.camera.position.set(CAMERA_X, CAMERA_Y, CAMERA_Z)
    this.camera.lookAt(0, 0, 0)

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.08
    this.renderer.domElement.className = 'cube-canvas'
    this.renderer.domElement.setAttribute('aria-label', '可操控的三维个人空间')
    this.host.insertBefore(this.renderer.domElement, this.host.firstChild)

    var hemi = new THREE.HemisphereLight(0xf7f1df, 0x496673, 2.2)
    this.scene.add(hemi)
    var sun = new THREE.DirectionalLight(0xfff2dc, 3.4)
    sun.position.set(-7, 13, 6)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left = -10
    sun.shadow.camera.right = 10
    sun.shadow.camera.top = 10
    sun.shadow.camera.bottom = -10
    sun.shadow.bias = -0.0005
    this.scene.add(sun)

    this.createEnvironment()
    this.createTiles()
    this.createDecorations()
    this.createBuildings()

    this.cube = makeCube(this.renderer)
    this.cube.position.set(0, floorY(0) + CUBE_SIZE / 2, 0)
    this.scene.add(this.cube)

  }

  World.prototype.createEnvironment = function () {
    var waterGeometry = new THREE.PlaneGeometry(44, 34, 40, 30)
    waterGeometry.rotateX(-Math.PI / 2)
    var waterPositions = waterGeometry.attributes.position
    this.waterBase = []
    for (var vertex = 0; vertex < waterPositions.count; vertex += 1) {
      var wx = waterPositions.getX(vertex)
      var wz = waterPositions.getZ(vertex)
      waterPositions.setY(vertex, waterHeightAt(wx, wz, 0))
      this.waterBase.push({ x: wx, z: wz })
    }
    waterGeometry.computeVertexNormals()
    this.waterGeometry = waterGeometry
    var deepWater = new THREE.Mesh(
      new THREE.PlaneGeometry(44, 34),
      new THREE.MeshBasicMaterial({ color: 0x315f75 })
    )
    deepWater.rotation.x = -Math.PI / 2
    deepWater.position.y = WATER_BOTTOM_Y
    deepWater.receiveShadow = true
    this.scene.add(deepWater)

    var middleWater = new THREE.Mesh(
      new THREE.PlaneGeometry(44, 34),
      new THREE.MeshBasicMaterial({ color: 0x4b91a3, transparent: true, opacity: 0.1, depthWrite: false })
    )
    middleWater.rotation.x = -Math.PI / 2
    middleWater.position.y = WATER_Y - 0.42
    this.scene.add(middleWater)

    this.water = new THREE.Mesh(
      waterGeometry,
      new THREE.MeshPhysicalMaterial({
        color: 0x9adce2,
        transparent: true,
        opacity: 0.28,
        roughness: 0.16,
        metalness: 0,
        clearcoat: 0.58,
        clearcoatRoughness: 0.22,
        ior: 1.33,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    )
    this.water.receiveShadow = true
    this.scene.add(this.water)
    this.waterContacts = []
    this.shorelineMaterials = {}

    var islandMaterialA = new THREE.MeshStandardMaterial({ color: 0x6f8d89, roughness: 0.94, flatShading: true })
    var islandMaterialB = new THREE.MeshStandardMaterial({ color: 0x8ba49b, roughness: 0.9, flatShading: true })
    var spireMaterial = new THREE.MeshStandardMaterial({ color: 0xb7c9ba, roughness: 0.82, flatShading: true })
    var islands = [
      [-8.2, -5.4, 1.45, 0], [8.5, 5.8, 1.7, 1], [-8.6, 5.4, 1.15, 1],
      [8.2, -6.1, 1.3, 0], [0.3, 8.2, 1.2, 1], [-1.8, -8.1, 1.05, 0]
    ]
    for (var i = 0; i < islands.length; i += 1) {
      var island = islands[i]
      var islandGroup = new THREE.Group()
      var land = new THREE.Mesh(
        new THREE.DodecahedronGeometry(island[2], 0),
        island[3] ? islandMaterialB : islandMaterialA
      )
      land.scale.y = 0.32
      land.rotation.set(0.08 * i, 0.42 * i, -0.04 * i)
      land.position.y = WATER_Y + 0.04
      land.castShadow = true
      land.receiveShadow = true
      islandGroup.add(land)
      if (i % 2 === 0) {
        var spire = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.25 + i * 0.05, 5), spireMaterial)
        spire.position.y = WATER_Y + 0.62
        spire.rotation.y = i * 0.31
        spire.castShadow = true
        islandGroup.add(spire)
      }
      islandGroup.position.set(island[0], 0, island[1])
      this.scene.add(islandGroup)
    }

    this.waterRings = []
    var ringMaterialColors = [0x9dd5ce, 0xb5dad0, 0x83c2c2]
    var ringPositions = [[-5.8, -4.2], [6.8, -4.7], [-7.2, 3.5]]
    for (var ringIndex = 0; ringIndex < ringPositions.length; ringIndex += 1) {
      var ringMaterial = new THREE.MeshBasicMaterial({
        color: ringMaterialColors[ringIndex], transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false
      })
      var ring = new THREE.Mesh(new THREE.RingGeometry(0.52, 0.56, 24), ringMaterial)
      ring.rotation.x = -Math.PI / 2
      ring.position.set(ringPositions[ringIndex][0], WATER_Y + 0.055, ringPositions[ringIndex][1])
      ring.userData.phase = ringIndex / ringPositions.length
      this.scene.add(ring)
      this.waterRings.push(ring)
    }
  }

  World.prototype.addWaterContact = function (x, z, innerRadius, outerRadius, seed, segments, opacity) {
    return this.addWaterContactGeometry(
      x,
      z,
      createShorelineGeometry(innerRadius, outerRadius, segments, seed),
      seed,
      opacity
    )
  }

  World.prototype.addWaterContactGeometry = function (x, z, geometry, seed, opacity) {
    var materialKey = String(opacity)
    if (!this.shorelineMaterials[materialKey]) {
      this.shorelineMaterials[materialKey] = new THREE.MeshBasicMaterial({
        color: 0xfffdf1, transparent: true, opacity: opacity, side: THREE.DoubleSide, depthWrite: false
      })
    }
    var shoreline = new THREE.Mesh(
      geometry,
      this.shorelineMaterials[materialKey]
    )
    shoreline.position.set(x, waterHeightAt(x, z, 0) + 0.055, z)
    shoreline.renderOrder = 4
    this.scene.add(shoreline)
    this.waterContacts.push({ mesh: shoreline, x: x, z: z, phase: seed })
    return shoreline
  }

  World.prototype.createTiles = function () {
    var tileHeight = 0.32
    var tileGeometry = createChamferedPrism(1.12, tileHeight, 0.1)
    var groundTopA = new THREE.MeshStandardMaterial({ color: 0xf2c8b5, roughness: 0.78 })
    var groundTopB = new THREE.MeshStandardMaterial({ color: 0xe8aaa8, roughness: 0.8 })
    var groundSide = new THREE.MeshStandardMaterial({ color: 0xac6f79, roughness: 0.9 })
    var highTopA = new THREE.MeshStandardMaterial({ color: 0xb9ddc4, roughness: 0.78 })
    var highTopB = new THREE.MeshStandardMaterial({ color: 0x91cbb6, roughness: 0.8 })
    var highSide = new THREE.MeshStandardMaterial({ color: 0x5c8e87, roughness: 0.9 })
    var spawnTop = new THREE.MeshStandardMaterial({ color: 0xf2d68b, emissive: 0x806126, emissiveIntensity: 0.1, roughness: 0.72 })
    var spawnSide = new THREE.MeshStandardMaterial({ color: 0xb48b4c, roughness: 0.86 })
    var supportGround = new THREE.MeshStandardMaterial({ color: 0x936578, roughness: 0.93, flatShading: true })
    var supportHigh = new THREE.MeshStandardMaterial({ color: 0x547c78, roughness: 0.93, flatShading: true })
    var groundInlay = new THREE.MeshBasicMaterial({ color: 0xffeee0, side: THREE.DoubleSide })
    var highInlay = new THREE.MeshBasicMaterial({ color: 0xe6f3d9, side: THREE.DoubleSide })
    var spawnInlay = new THREE.MeshBasicMaterial({ color: 0xfff2bd, side: THREE.DoubleSide })
    this.validCells = new Set()

    for (var i = 0; i < pathCells.length; i += 1) {
      var cell = pathCells[i]
      var x = cell.x
      var z = cell.z
      var key = x + ',' + z
      this.validCells.add(key)
      var topMaterial = x === 0 && z === 0 ? spawnTop : cell.level > 0
        ? ((x + z) % 2 === 0 ? highTopA : highTopB)
        : ((x + z) % 2 === 0 ? groundTopA : groundTopB)
      var sideMaterial = x === 0 && z === 0 ? spawnSide : cell.level > 0 ? highSide : groundSide
      var tile = new THREE.Mesh(tileGeometry, [topMaterial, sideMaterial])
      tile.position.set(x * GRID, floorY(cell.level) - tileHeight, z * GRID)
      tile.receiveShadow = true
      tile.castShadow = true
      this.scene.add(tile)

      if (i % 2 === 0 || x === 0 && z === 0) {
        var inlay = new THREE.Mesh(
          new THREE.RingGeometry(0.17, 0.27, 4),
          x === 0 && z === 0 ? spawnInlay : cell.level > 0 ? highInlay : groundInlay
        )
        inlay.rotation.x = -Math.PI / 2
        inlay.rotation.z = Math.PI / 4
        inlay.position.set(x * GRID, floorY(cell.level) + 0.008, z * GRID)
        this.scene.add(inlay)
      }

      var tileBottom = floorY(cell.level) - tileHeight
      var supportHeight = tileBottom - WATER_BOTTOM_Y + 0.03
      var supportMaterial = cell.level > 0 ? supportHigh : supportGround
      var supportGeometry = new THREE.CylinderGeometry(0.11, 0.17, supportHeight, 6)
      var supportPositions = [[-0.3, -0.3], [0.3, 0.3]]
      for (var supportIndex = 0; supportIndex < supportPositions.length; supportIndex += 1) {
        var supportX = x * GRID + supportPositions[supportIndex][0]
        var supportZ = z * GRID + supportPositions[supportIndex][1]
        var support = new THREE.Mesh(supportGeometry, supportMaterial)
        support.position.set(
          supportX,
          WATER_BOTTOM_Y + supportHeight / 2,
          supportZ
        )
        support.rotation.y = Math.PI / 6
        support.castShadow = true
        this.scene.add(support)
        this.addWaterContact(supportX, supportZ, 0.14, 0.19, i * 0.43 + supportIndex, 12, 0.42)
      }
      var underside = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.1, 0.84), supportMaterial)
      underside.position.set(x * GRID, tileBottom - 0.05, z * GRID)
      underside.castShadow = true
      this.scene.add(underside)
    }
  }

  World.prototype.createDecorations = function () {
    var isletMaterial = new THREE.MeshStandardMaterial({ color: 0x718c8c, roughness: 0.95, flatShading: true })
    var rockMaterial = new THREE.MeshStandardMaterial({ color: 0xaab6aa, roughness: 0.96, flatShading: true })
    var crystalMaterial = new THREE.MeshStandardMaterial({ color: 0x8ed8c6, emissive: 0x2f8178, emissiveIntensity: 0.16, roughness: 0.42, flatShading: true })
    var decorationCells = ['-3,-1', '3,-1', '-1,4', '1,4']
    for (var i = 0; i < decorationCells.length; i += 1) {
      var pair = decorationCells[i].split(',')
      var x = Number(pair[0])
      var z = Number(pair[1])
      var group = new THREE.Group()
      var islet = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.58, 0.16, 7), isletMaterial)
      islet.position.y = WATER_Y + 0.06
      islet.rotation.y = i * 0.44
      islet.castShadow = true
      islet.receiveShadow = true
      group.add(islet)
      var rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.34 + (i % 2) * 0.08, 0), rockMaterial)
      rock.position.y = WATER_Y + 0.34
      rock.rotation.set(i * 0.2, i * 0.7, i * 0.13)
      rock.castShadow = true
      group.add(rock)
      if (i % 2 === 0) {
        var crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), crystalMaterial)
        crystal.position.set(0.18, WATER_Y + 0.67, -0.08)
        crystal.castShadow = true
        group.add(crystal)
      }
      group.position.set(x * GRID, 0, z * GRID)
      this.scene.add(group)
    }
  }

  World.prototype.createBuildings = function () {
    this.buildingGroups = []
    for (var i = 0; i < entries.length; i += 1) {
      var entry = entries[i]
      var group = new THREE.Group()
      var color = new THREE.Color(entry.color)
      var shadeColor = color.clone().multiplyScalar(0.68)
      var lightColor = color.clone().lerp(new THREE.Color(0xfff5df), 0.42)
      var ivoryMaterial = new THREE.MeshStandardMaterial({ color: 0xf4edda, roughness: 0.76 })
      var trimMaterial = new THREE.MeshStandardMaterial({ color: lightColor, roughness: 0.7 })
      var bodyMaterial = new THREE.MeshStandardMaterial({ color: color, roughness: 0.72 })
      var sideMaterial = new THREE.MeshStandardMaterial({ color: shadeColor, roughness: 0.8 })

      var foundationHeight = FLOOR_TOP - WATER_BOTTOM_Y + entry.level * LEVEL_HEIGHT
      var foundationMaterial = new THREE.MeshStandardMaterial({
        color: shadeColor.clone().lerp(new THREE.Color(0x8fb0aa), 0.36), roughness: 0.9, flatShading: true
      })
      var foundationFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.9, 0.22, 8), foundationMaterial)
      foundationFoot.position.y = WATER_BOTTOM_Y - entry.level * LEVEL_HEIGHT + 0.08
      foundationFoot.castShadow = true
      foundationFoot.receiveShadow = true
      group.add(foundationFoot)

      var foundation = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, foundationHeight, 8), foundationMaterial)
      foundation.position.y = FLOOR_TOP - foundationHeight / 2
      foundation.rotation.y = Math.PI / 8
      foundation.castShadow = true
      foundation.receiveShadow = true
      group.add(foundation)

      var base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.75, 0.88, 0.24, 8),
        ivoryMaterial
      )
      base.position.y = FLOOR_TOP + 0.12
      base.castShadow = true
      base.receiveShadow = true
      group.add(base)

      var lowerStep = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.18, 8), trimMaterial)
      lowerStep.position.y = FLOOR_TOP + 0.27
      lowerStep.castShadow = true
      group.add(lowerStep)

      var body = new THREE.Mesh(createChamferedPrism(0.96, 1.34, 0.11), [bodyMaterial, sideMaterial])
      body.position.y = FLOOR_TOP + 0.27
      body.castShadow = true
      body.receiveShadow = true
      group.add(body)

      var pilasterGeometry = new THREE.BoxGeometry(0.11, 1.24, 0.11)
      var pilasterPositions = [[-0.43, -0.43], [0.43, -0.43], [-0.43, 0.43], [0.43, 0.43]]
      for (var pilasterIndex = 0; pilasterIndex < pilasterPositions.length; pilasterIndex += 1) {
        var pilaster = new THREE.Mesh(pilasterGeometry, trimMaterial)
        pilaster.position.set(pilasterPositions[pilasterIndex][0], FLOOR_TOP + 0.92, pilasterPositions[pilasterIndex][1])
        pilaster.castShadow = true
        group.add(pilaster)
      }

      var cornice = new THREE.Mesh(createChamferedPrism(1.16, 0.16, 0.12), [ivoryMaterial, trimMaterial])
      cornice.position.y = FLOOR_TOP + 1.58
      cornice.castShadow = true
      group.add(cornice)

      var roofBase = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.68, 0.14, 8), trimMaterial)
      roofBase.position.y = FLOOR_TOP + 1.81
      roofBase.castShadow = true
      group.add(roofBase)

      var roof = new THREE.Mesh(new THREE.ConeGeometry(0.72, 0.72, 4), ivoryMaterial)
      roof.position.y = FLOOR_TOP + 2.2
      roof.rotation.y = Math.PI / 4
      roof.castShadow = true
      group.add(roof)

      var crown = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), new THREE.MeshStandardMaterial({
        color: lightColor, emissive: color, emissiveIntensity: 0.28, roughness: 0.38, flatShading: true
      }))
      crown.position.y = FLOOR_TOP + 2.7
      crown.rotation.y = Math.PI / 4
      crown.castShadow = true
      group.add(crown)

      var doorFrame = new THREE.Mesh(createArchGeometry(0.52, 0.76), ivoryMaterial)
      doorFrame.position.set(0, FLOOR_TOP + 0.28, 0.492)
      group.add(doorFrame)

      var doorMaterial = new THREE.MeshStandardMaterial({ color: shadeColor, emissive: color, emissiveIntensity: 0.55, roughness: 0.32 })
      var door = new THREE.Mesh(createArchGeometry(0.34, 0.6), doorMaterial)
      door.position.set(0, FLOOR_TOP + 0.28, 0.498)
      group.add(door)

      var rearDoorFrame = doorFrame.clone()
      rearDoorFrame.position.z = -0.492
      rearDoorFrame.rotation.y = Math.PI
      group.add(rearDoorFrame)

      var rearDoor = door.clone()
      rearDoor.position.z = -0.498
      rearDoor.rotation.y = Math.PI
      group.add(rearDoor)

      var relief = new THREE.Mesh(new THREE.CircleGeometry(0.13, 4), trimMaterial)
      relief.position.set(0, FLOOR_TOP + 1.25, 0.505)
      relief.rotation.z = Math.PI / 4
      group.add(relief)

      var rearRelief = relief.clone()
      rearRelief.position.z = -0.505
      rearRelief.rotation.y = Math.PI
      group.add(rearRelief)

      var ringMaterial = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.42, side: THREE.DoubleSide })
      var ring = new THREE.Mesh(new THREE.RingGeometry(0.54, 0.68, 8), ringMaterial)
      ring.rotation.x = -Math.PI / 2
      ring.position.y = FLOOR_TOP + 0.018
      group.add(ring)

      group.position.set(entry.x * GRID, entry.level * LEVEL_HEIGHT, entry.z * GRID)
      group.rotation.y = entry.facing
      group.userData = { entry: entry, doorMaterial: doorMaterial, ringMaterial: ringMaterial, crown: crown }
      this.scene.add(group)
      this.addWaterContact(entry.x * GRID, entry.z * GRID, 0.68, 0.78, 20 + i * 1.37, 16, 0.86)
      this.buildingGroups.push(group)

      var label = document.createElement('div')
      label.className = 'world-label'
      label.innerHTML = '<span class="world-label-name">' + entry.name + '</span>'
      this.host.appendChild(label)
      this.labelNodes.push({ element: label, group: group, entry: entry })
    }
  }

  World.prototype.canMove = function (x, z) {
    var key = x + ',' + z
    return this.validCells.has(key) && !blocked.has(key)
  }

  World.prototype.requestMove = function (dx, dz) {
    if (this.movement || this.destroyed) return
    var targetX = this.player.x + dx
    var targetZ = this.player.z + dz
    if (!this.canMove(targetX, targetZ)) {
      this.showToast('这边被挡住了')
      this.playSfx('blocked')
      return
    }
    var targetLevel = getCellLevel(targetX, targetZ)
    var levelDelta = targetLevel - this.player.level

    var start = this.cube.position.clone()
    var targetCenterY = floorY(targetLevel) + CUBE_SIZE / 2
    var pivotY = levelDelta === 0 ? floorY(this.player.level) : (start.y + targetCenterY) / 2
    var pivot = new THREE.Vector3(
      start.x + dx * CUBE_SIZE / 2,
      pivotY,
      start.z + dz * CUBE_SIZE / 2
    )
    var axis = new THREE.Vector3(dz, 0, -dx).normalize()
    this.movement = {
      startedAt: performance.now(),
      duration: levelDelta === 0 ? MOVE_MS : LEVEL_MOVE_MS,
      rotationAngle: levelDelta === 0 ? Math.PI / 2 : Math.PI,
      start: start,
      pivot: pivot,
      axis: axis,
      startQuaternion: this.cube.quaternion.clone(),
      dx: dx,
      dz: dz,
      targetX: targetX,
      targetZ: targetZ,
      targetLevel: targetLevel,
      levelDelta: levelDelta
    }
    if (levelDelta > 0) this.showToast('上翻到高台')
    if (levelDelta < 0) this.showToast('前方落差，准备下落')
    this.playSfx(levelDelta > 0 ? 'up' : (levelDelta < 0 ? 'down' : 'roll'))
  }

  World.prototype.updateMovement = function (now) {
    if (!this.movement) return
    var move = this.movement
    var raw = Math.min(1, (now - move.startedAt) / move.duration)
    var t = raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2
    var angle = t * move.rotationAngle
    var offset = move.start.clone().sub(move.pivot).applyAxisAngle(move.axis, angle)
    this.cube.position.copy(move.pivot).add(offset)
    var rotation = new THREE.Quaternion().setFromAxisAngle(move.axis, angle)
    this.cube.quaternion.copy(move.startQuaternion).premultiply(rotation)

    if (raw >= 1) {
      this.player.x = move.targetX
      this.player.z = move.targetZ
      this.player.level = move.targetLevel
      this.cube.position.set(this.player.x * GRID, floorY(this.player.level) + CUBE_SIZE / 2, this.player.z * GRID)
      var exactRotation = new THREE.Quaternion().setFromAxisAngle(move.axis, move.rotationAngle)
      this.cube.quaternion.copy(move.startQuaternion).premultiply(exactRotation).normalize()
      this.movement = null
      this.updateEntryState()
      if (this.heldMovement) {
        var self = this
        global.clearTimeout(this.repeatTimer)
        this.repeatTimer = global.setTimeout(function () {
          if (self.heldMovement && !self.movement) {
            self.requestMove(self.heldMovement[0], self.heldMovement[1])
          }
        }, REPEAT_GAP_MS)
      }
    }
  }

  World.prototype.updateEntryState = function () {
    var previousEntry = this.activeEntry
    var found = null
    for (var i = 0; i < entries.length; i += 1) {
      var entry = entries[i]
      if (this.player.level === entry.level && Math.abs(this.player.x - entry.x) + Math.abs(this.player.z - entry.z) === 1) {
        found = entry
        break
      }
    }
    this.activeEntry = found
    if (found && (!previousEntry || previousEntry.id !== found.id)) this.playSfx('entry')

    if (found) {
      this.hudState.textContent = '入口已激活 · 按 Enter'
      this.hudTitle.textContent = found.name
      this.hudDesc.textContent = found.desc
      this.enterButton.disabled = false
      this.enterButton.textContent = '进入 ' + found.name
    } else {
      this.hudState.textContent = '探索模式'
      this.hudTitle.textContent = '移动到建筑门前'
      this.hudDesc.textContent = '沿石桥翻滚，在高低层交界处上翻或下落。'
      this.enterButton.disabled = true
      this.enterButton.textContent = '进入'
    }

    for (var j = 0; j < this.buildingGroups.length; j += 1) {
      var group = this.buildingGroups[j]
      var active = found && group.userData.entry.id === found.id
      group.userData.doorMaterial.emissiveIntensity = active ? 2.7 : 0.7
      group.userData.ringMaterial.opacity = active ? 0.9 : 0.42
      group.scale.setScalar(active ? 1.08 : 1)
    }
    for (var k = 0; k < this.labelNodes.length; k += 1) {
      var labelItem = this.labelNodes[k]
      labelItem.element.classList.toggle('active', Boolean(found && labelItem.entry.id === found.id))
    }
  }

  World.prototype.enter = function () {
    if (!this.activeEntry) return
    var targetRoute = this.activeEntry.route
    this.playSfx('confirm')
    global.clearTimeout(this.routeTimer)
    this.routeTimer = global.setTimeout(function () { route(targetRoute) }, 120)
  }

  World.prototype.showToast = function (message) {
    this.toast.textContent = message
    this.toast.classList.add('show')
    global.clearTimeout(this.toastTimer)
    var self = this
    this.toastTimer = global.setTimeout(function () { self.toast.classList.remove('show') }, 950)
  }

  World.prototype.bindEvents = function () {
    var self = this
    this.onKeyDown = function (event) {
      self.ensureAudio()
      var key = event.key.toLowerCase()
      var movement = null
      if (key === 'w' || key === 'arrowup') movement = [0, -1]
      else if (key === 'a' || key === 'arrowleft') movement = [-1, 0]
      else if (key === 'd' || key === 'arrowright') movement = [1, 0]
      else if (key === 's' || key === 'arrowdown') movement = [0, 1]
      else if (key === 'enter' || key === ' ') {
        event.preventDefault()
        self.enter()
        return
      }
      if (movement) {
        event.preventDefault()
        self.heldMovement = movement
        if (!event.repeat) self.requestMove(movement[0], movement[1])
      }
    }
    this.onKeyUp = function (event) {
      var key = event.key.toLowerCase()
      if (key === 'w' || key === 'a' || key === 's' || key === 'd' || key.indexOf('arrow') === 0) {
        self.heldMovement = null
        global.clearTimeout(self.repeatTimer)
      }
    }
    this.onResize = function () { self.resize() }
    global.addEventListener('keydown', this.onKeyDown)
    global.addEventListener('keyup', this.onKeyUp)
    global.addEventListener('resize', this.onResize)

    this.ui.addEventListener('click', function (event) {
      var audioButton = event.target.closest('.cube-audio-toggle')
      if (audioButton) {
        self.toggleAudio()
        return
      }
      self.ensureAudio()
      var routeButton = event.target.closest('[data-route]')
      if (routeButton) {
        var targetRoute = routeButton.dataset.route
        self.playSfx('confirm')
        global.clearTimeout(self.routeTimer)
        self.routeTimer = global.setTimeout(function () { route(targetRoute) }, 120)
        return
      }
      var moveButton = event.target.closest('[data-dx]')
      if (moveButton) self.requestMove(Number(moveButton.dataset.dx), Number(moveButton.dataset.dz))
    })
    this.enterButton.addEventListener('click', function () { self.enter() })
  }

  World.prototype.resize = function () {
    var width = Math.max(1, this.host.clientWidth)
    var height = Math.max(1, this.host.clientHeight)
    var aspect = width / height
    var viewHeight = width < 760 ? 14.5 : 12.1
    this.camera.left = -viewHeight * aspect / 2
    this.camera.right = viewHeight * aspect / 2
    this.camera.top = viewHeight / 2
    this.camera.bottom = -viewHeight / 2
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height, false)
  }

  World.prototype.updateLabels = function (elapsed) {
    var rect = this.host.getBoundingClientRect()
    for (var i = 0; i < this.labelNodes.length; i += 1) {
      var item = this.labelNodes[i]
      var position = new THREE.Vector3()
      item.group.getWorldPosition(position)
      position.y += 2.96 + Math.sin(elapsed * 1.8 + i) * 0.025
      position.project(this.camera)
      item.element.style.left = ((position.x * 0.5 + 0.5) * rect.width) + 'px'
      item.element.style.top = ((-position.y * 0.5 + 0.5) * rect.height) + 'px'
      var outside = position.z > 1 || position.x < -0.82 || position.x > 0.82 || position.y < -0.98 || position.y > 0.98
      item.element.style.opacity = outside ? '0' : '1'
    }
  }

  World.prototype.updateEnvironment = function (elapsed) {
    if (this.waterGeometry && this.waterBase) {
      var positions = this.waterGeometry.attributes.position
      for (var i = 0; i < positions.count; i += 1) {
        var base = this.waterBase[i]
        positions.setY(i, waterHeightAt(base.x, base.z, elapsed))
      }
      positions.needsUpdate = true
      this.environmentFrame = (this.environmentFrame || 0) + 1
      if (this.environmentFrame % 3 === 0) this.waterGeometry.computeVertexNormals()
    }
    for (var ringIndex = 0; ringIndex < this.waterRings.length; ringIndex += 1) {
      var ring = this.waterRings[ringIndex]
      var phase = (elapsed * 0.12 + ring.userData.phase) % 1
      var scale = 0.7 + phase * 1.7
      ring.scale.set(scale, scale, scale)
      ring.position.y = waterHeightAt(ring.position.x, ring.position.z, elapsed) + 0.055
      ring.material.opacity = 0.24 * (1 - phase)
    }
    for (var contactIndex = 0; contactIndex < this.waterContacts.length; contactIndex += 1) {
      var contact = this.waterContacts[contactIndex]
      contact.mesh.position.y = waterHeightAt(contact.x, contact.z, elapsed) + 0.055
    }
  }

  World.prototype.animate = function () {
    if (this.destroyed) return
    var self = this
    this.raf = global.requestAnimationFrame(function () { self.animate() })
    var now = performance.now()
    var elapsed = this.clock.getElapsedTime()
    this.updateMovement(now)
    this.updateEnvironment(elapsed)
    this.cameraTarget.set(this.cube.position.x, this.cube.position.y - CUBE_SIZE / 2, this.cube.position.z)
    this.cameraFocus.lerp(this.cameraTarget, 0.075)
    this.camera.position.set(CAMERA_X + this.cameraFocus.x, CAMERA_Y + this.cameraFocus.y * 0.35, CAMERA_Z + this.cameraFocus.z)
    this.camera.lookAt(this.cameraFocus.x, this.cameraFocus.y * 0.32, this.cameraFocus.z)

    for (var i = 0; i < this.buildingGroups.length; i += 1) {
      var group = this.buildingGroups[i]
      group.userData.crown.rotation.y += 0.004
      group.userData.ringMaterial.opacity += Math.sin(elapsed * 2.2 + i) * 0.0015
    }
    this.updateLabels(elapsed)
    this.renderer.render(this.scene, this.camera)
  }

  World.prototype.destroy = function () {
    if (this.destroyed) return
    this.destroyed = true
    global.cancelAnimationFrame(this.raf)
    global.clearTimeout(this.toastTimer)
    global.clearTimeout(this.repeatTimer)
    global.clearTimeout(this.routeTimer)
    global.removeEventListener('keydown', this.onKeyDown)
    global.removeEventListener('keyup', this.onKeyUp)
    global.removeEventListener('resize', this.onResize)
    if (this.audioState) {
      global.clearInterval(this.audioState.ambientTimer)
      if (this.audioState.ambientNoise) {
        try { this.audioState.ambientNoise.stop() } catch (error) {}
      }
      this.audioState.context.close()
      this.audioState = null
    }
    this.renderer.dispose()
    this.host.innerHTML = ''
  }

  global.PersonalCubeWorld = {
    mount: function (host) {
      if (!THREE || !host) return
      if (runtime) runtime.destroy()
      runtime = new World(host)
    },
    destroy: function () {
      if (runtime) runtime.destroy()
      runtime = null
    }
  }
})(window)
