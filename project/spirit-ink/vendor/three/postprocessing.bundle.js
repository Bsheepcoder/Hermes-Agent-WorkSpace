/**
 * Three.js Postprocessing Bundle (IIFE)
 * Converted from ES module addons for file:// compatibility.
 * Requires window.THREE to be loaded first (three.min.js).
 *
 * Exposes:
 *   CopyShader, GammaCorrectionShader, ShaderPass, EffectComposer,
 *   RenderPass, UnrealBloomPass
 */
(function () {
  'use strict';

  var THREE = window.THREE;
  if (!THREE) {
    throw new Error('postprocessing.bundle.js requires THREE to be loaded first');
  }

  // ─── Shaders ────────────────────────────────────────────────

  var CopyShader = {
    uniforms: {
      'tDiffuse': { value: null },
      'opacity': { value: 1.0 }
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }`,
    fragmentShader: /* glsl */`
      uniform float opacity;
      uniform sampler2D tDiffuse;
      varying vec2 vUv;
      void main() {
        gl_FragColor = texture2D( tDiffuse, vUv );
        gl_FragColor.a *= opacity;
      }`
  };

  var GammaCorrectionShader = {
    uniforms: {
      'tDiffuse': { value: null }
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tDiffuse;
      varying vec2 vUv;
      void main() {
        vec4 tex = texture2D( tDiffuse, vUv );
        gl_FragColor = LinearTosRGB( tex );
      }`
  };

  var LuminosityHighPassShader = {
    name: 'LuminosityHighPassShader',
    shaderID: 'luminosityHighPass',
    uniforms: {
      'tDiffuse': { value: null },
      'luminosityThreshold': { value: 1.0 },
      'smoothWidth': { value: 1.0 },
      'defaultColor': { value: new THREE.Color( 0x000000 ) },
      'defaultOpacity': { value: 0.0 }
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tDiffuse;
      uniform vec3 defaultColor;
      uniform float defaultOpacity;
      uniform float luminosityThreshold;
      uniform float smoothWidth;
      varying vec2 vUv;
      void main() {
        vec4 texel = texture2D( tDiffuse, vUv );
        float v = luminance( texel.xyz );
        vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );
        float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );
        gl_FragColor = mix( outputColor, texel, alpha );
      }`
  };

  // ─── Pass base class + FullScreenQuad ───────────────────────

  var _camera = new THREE.OrthographicCamera( - 1, 1, 1, - 1, 0, 1 );

  // r128+ BufferGeometry is an ES class — must use Reflect.construct
  var _geometry;  // declare early for the IIFE below

  function FullscreenTriangleGeometry() {
    return Reflect.construct( THREE.BufferGeometry, [], FullscreenTriangleGeometry );
  }
  FullscreenTriangleGeometry.prototype = Object.create( THREE.BufferGeometry.prototype );
  FullscreenTriangleGeometry.prototype.constructor = FullscreenTriangleGeometry;

  (function () {
    var g = new FullscreenTriangleGeometry();
    g.setAttribute( 'position', new THREE.Float32BufferAttribute( [ - 1, 3, 0, - 1, - 1, 0, 3, - 1, 0 ], 3 ) );
    g.setAttribute( 'uv', new THREE.Float32BufferAttribute( [ 0, 2, 0, 0, 2, 0 ], 2 ) );
    _geometry = g;
  })();

  function Pass() {
    this.isPass = true;
    this.enabled = true;
    this.needsSwap = true;
    this.clear = false;
    this.renderToScreen = false;
  }
  Pass.prototype.setSize = function () {};
  Pass.prototype.render = function () {
    console.error( 'THREE.Pass: .render() must be implemented in derived pass.' );
  };
  Pass.prototype.dispose = function () {};

  function FullScreenQuad( material ) {
    this._mesh = new THREE.Mesh( _geometry, material );
  }
  FullScreenQuad.prototype.dispose = function () {
    this._mesh.geometry.dispose();
  };
  FullScreenQuad.prototype.render = function ( renderer ) {
    renderer.render( this._mesh, _camera );
  };
  Object.defineProperty( FullScreenQuad.prototype, 'material', {
    get: function () { return this._mesh.material; },
    set: function ( value ) { this._mesh.material = value; }
  });

  // ─── ShaderPass ─────────────────────────────────────────────

  function ShaderPassClass( shader, textureID ) {
    Pass.call( this );
    this.textureID = ( textureID !== undefined ) ? textureID : 'tDiffuse';
    if ( shader instanceof THREE.ShaderMaterial ) {
      this.uniforms = shader.uniforms;
      this.material = shader;
    } else if ( shader ) {
      this.uniforms = THREE.UniformsUtils.clone( shader.uniforms );
      this.material = new THREE.ShaderMaterial( {
        defines: Object.assign( {}, shader.defines ),
        uniforms: this.uniforms,
        vertexShader: shader.vertexShader,
        fragmentShader: shader.fragmentShader
      } );
    }
    this.fsQuad = new FullScreenQuad( this.material );
  }
  ShaderPassClass.prototype = Object.create( Pass.prototype );
  ShaderPassClass.prototype.constructor = ShaderPassClass;
  ShaderPassClass.prototype.render = function ( renderer, writeBuffer, readBuffer ) {
    if ( this.uniforms[ this.textureID ] ) {
      this.uniforms[ this.textureID ].value = readBuffer.texture;
    }
    this.fsQuad.material = this.material;
    if ( this.renderToScreen ) {
      renderer.setRenderTarget( null );
      this.fsQuad.render( renderer );
    } else {
      renderer.setRenderTarget( writeBuffer );
      if ( this.clear ) renderer.clear( renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil );
      this.fsQuad.render( renderer );
    }
  };
  ShaderPassClass.prototype.dispose = function () {
    this.material.dispose();
    this.fsQuad.dispose();
  };

  var ShaderPass = ShaderPassClass;

  // ─── EffectComposer ─────────────────────────────────────────

  function EffectComposerClass( renderer, renderTarget ) {
    this.renderer = renderer;
    this._pixelRatio = renderer.getPixelRatio();

    if ( renderTarget === undefined ) {
      var size = renderer.getSize( new THREE.Vector2() );
      this._width = size.width;
      this._height = size.height;
      renderTarget = new THREE.WebGLRenderTarget( this._width * this._pixelRatio, this._height * this._pixelRatio );
      renderTarget.texture.name = 'EffectComposer.rt1';
    } else {
      this._width = renderTarget.width;
      this._height = renderTarget.height;
    }

    this.renderTarget1 = renderTarget;
    this.renderTarget2 = renderTarget.clone();
    this.renderTarget2.texture.name = 'EffectComposer.rt2';
    this.writeBuffer = this.renderTarget1;
    this.readBuffer = this.renderTarget2;
    this.renderToScreen = true;
    this.passes = [];
    this.copyPass = new ShaderPass( CopyShader );
    this.clock = new THREE.Clock();
  }

  EffectComposerClass.prototype.swapBuffers = function () {
    var tmp = this.readBuffer;
    this.readBuffer = this.writeBuffer;
    this.writeBuffer = tmp;
  };

  EffectComposerClass.prototype.addPass = function ( pass ) {
    this.passes.push( pass );
    pass.setSize( this._width * this._pixelRatio, this._height * this._pixelRatio );
  };

  EffectComposerClass.prototype.insertPass = function ( pass, index ) {
    this.passes.splice( index, 0, pass );
    pass.setSize( this._width * this._pixelRatio, this._height * this._pixelRatio );
  };

  EffectComposerClass.prototype.removePass = function ( pass ) {
    var index = this.passes.indexOf( pass );
    if ( index !== - 1 ) {
      this.passes.splice( index, 1 );
    }
  };

  EffectComposerClass.prototype.isLastEnabledPass = function ( passIndex ) {
    for ( var i = passIndex + 1; i < this.passes.length; i ++ ) {
      if ( this.passes[ i ].enabled ) {
        return false;
      }
    }
    return true;
  };

  EffectComposerClass.prototype.render = function ( deltaTime ) {
    if ( deltaTime === undefined ) {
      deltaTime = this.clock.getDelta();
    }

    var currentRenderTarget = this.renderer.getRenderTarget();
    var maskActive = false;

    for ( var i = 0, il = this.passes.length; i < il; i ++ ) {
      var pass = this.passes[ i ];
      if ( pass.enabled === false ) continue;
      pass.renderToScreen = ( this.renderToScreen && this.isLastEnabledPass( i ) );
      pass.render( this.renderer, this.writeBuffer, this.readBuffer, deltaTime, maskActive );

      if ( pass.needsSwap ) {
        if ( maskActive ) {
          var context = this.renderer.getContext();
          var stencil = this.renderer.state.buffers.stencil;
          stencil.setFunc( context.NOTEQUAL, 1, 0xffffffff );
          this.copyPass.render( this.renderer, this.writeBuffer, this.readBuffer, deltaTime );
          stencil.setFunc( context.EQUAL, 1, 0xffffffff );
        }
        this.swapBuffers();
      }
    }

    this.renderer.setRenderTarget( currentRenderTarget );
  };

  EffectComposerClass.prototype.reset = function ( renderTarget ) {
    if ( renderTarget === undefined ) {
      var size = this.renderer.getSize( new THREE.Vector2() );
      this._pixelRatio = this.renderer.getPixelRatio();
      this._width = size.width;
      this._height = size.height;
      renderTarget = this.renderTarget1.clone();
      renderTarget.setSize( this._width * this._pixelRatio, this._height * this._pixelRatio );
    }
    this.renderTarget1.dispose();
    this.renderTarget2.dispose();
    this.renderTarget1 = renderTarget;
    this.renderTarget2 = renderTarget.clone();
    this.writeBuffer = this.renderTarget1;
    this.readBuffer = this.renderTarget2;
  };

  EffectComposerClass.prototype.setSize = function ( width, height ) {
    this._width = width;
    this._height = height;
    var effectiveWidth = this._width * this._pixelRatio;
    var effectiveHeight = this._height * this._pixelRatio;
    this.renderTarget1.setSize( effectiveWidth, effectiveHeight );
    this.renderTarget2.setSize( effectiveWidth, effectiveHeight );
    for ( var i = 0; i < this.passes.length; i ++ ) {
      this.passes[ i ].setSize( effectiveWidth, effectiveHeight );
    }
  };

  EffectComposerClass.prototype.setPixelRatio = function ( pixelRatio ) {
    this._pixelRatio = pixelRatio;
    this.setSize( this._width, this._height );
  };

  EffectComposerClass.prototype.dispose = function () {
    this.renderTarget1.dispose();
    this.renderTarget2.dispose();
    this.copyPass.dispose();
  };

  var EffectComposer = EffectComposerClass;

  // ─── RenderPass ─────────────────────────────────────────────

  function RenderPassClass( scene, camera, overrideMaterial, clearColor, clearAlpha ) {
    Pass.call( this );
    this.scene = scene;
    this.camera = camera;
    this.overrideMaterial = overrideMaterial;
    this.clearColor = clearColor;
    this.clearAlpha = ( clearAlpha !== undefined ) ? clearAlpha : 0;
    this.clear = true;
    this.clearDepth = false;
    this.needsSwap = false;
    this._oldClearColor = new THREE.Color();
  }
  RenderPassClass.prototype = Object.create( Pass.prototype );
  RenderPassClass.prototype.constructor = RenderPassClass;
  RenderPassClass.prototype.render = function ( renderer, writeBuffer, readBuffer ) {
    var oldAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    var oldClearAlpha, oldOverrideMaterial;
    if ( this.overrideMaterial !== undefined ) {
      oldOverrideMaterial = this.scene.overrideMaterial;
      this.scene.overrideMaterial = this.overrideMaterial;
    }
    if ( this.clearColor ) {
      renderer.getClearColor( this._oldClearColor );
      oldClearAlpha = renderer.getClearAlpha();
      renderer.setClearColor( this.clearColor, this.clearAlpha );
    }
    if ( this.clearDepth ) {
      renderer.clearDepth();
    }
    renderer.setRenderTarget( this.renderToScreen ? null : readBuffer );
    if ( this.clear ) renderer.clear( renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil );
    renderer.render( this.scene, this.camera );
    if ( this.clearColor ) {
      renderer.setClearColor( this._oldClearColor, oldClearAlpha );
    }
    if ( this.overrideMaterial !== undefined ) {
      this.scene.overrideMaterial = oldOverrideMaterial;
    }
    renderer.autoClear = oldAutoClear;
  };

  var RenderPass = RenderPassClass;

  // ─── UnrealBloomPass ────────────────────────────────────────

  function UnrealBloomPassClass( resolution, strength, radius, threshold ) {
    Pass.call( this );

    this.strength = ( strength !== undefined ) ? strength : 1;
    this.radius = radius;
    this.threshold = threshold;
    this.resolution = ( resolution !== undefined ) ? new THREE.Vector2( resolution.x, resolution.y ) : new THREE.Vector2( 256, 256 );
    this.clearColor = new THREE.Color( 0, 0, 0 );

    // render targets
    this.renderTargetsHorizontal = [];
    this.renderTargetsVertical = [];
    this.nMips = 5;
    var resx = Math.round( this.resolution.x / 2 );
    var resy = Math.round( this.resolution.y / 2 );

    this.renderTargetBright = new THREE.WebGLRenderTarget( resx, resy );
    this.renderTargetBright.texture.name = 'UnrealBloomPass.bright';
    this.renderTargetBright.texture.generateMipmaps = false;

    for ( var i = 0; i < this.nMips; i ++ ) {
      var renderTargetHorizonal = new THREE.WebGLRenderTarget( resx, resy );
      renderTargetHorizonal.texture.name = 'UnrealBloomPass.h' + i;
      renderTargetHorizonal.texture.generateMipmaps = false;
      this.renderTargetsHorizontal.push( renderTargetHorizonal );

      var renderTargetVertical = new THREE.WebGLRenderTarget( resx, resy );
      renderTargetVertical.texture.name = 'UnrealBloomPass.v' + i;
      renderTargetVertical.texture.generateMipmaps = false;
      this.renderTargetsVertical.push( renderTargetVertical );

      resx = Math.round( resx / 2 );
      resy = Math.round( resy / 2 );
    }

    // luminosity high pass material
    var highPassShader = LuminosityHighPassShader;
    this.highPassUniforms = THREE.UniformsUtils.clone( highPassShader.uniforms );
    this.highPassUniforms[ 'luminosityThreshold' ].value = threshold;
    this.highPassUniforms[ 'smoothWidth' ].value = 0.01;
    this.materialHighPassFilter = new THREE.ShaderMaterial( {
      uniforms: this.highPassUniforms,
      vertexShader: highPassShader.vertexShader,
      fragmentShader: highPassShader.fragmentShader,
      defines: {}
    } );

    // Gaussian Blur Materials
    this.separableBlurMaterials = [];
    var kernelSizeArray = [ 3, 5, 7, 9, 11 ];
    resx = Math.round( this.resolution.x / 2 );
    resy = Math.round( this.resolution.y / 2 );
    for ( var i = 0; i < this.nMips; i ++ ) {
      this.separableBlurMaterials.push( this.getSeperableBlurMaterial( kernelSizeArray[ i ] ) );
      this.separableBlurMaterials[ i ].uniforms[ 'texSize' ].value = new THREE.Vector2( resx, resy );
      resx = Math.round( resx / 2 );
      resy = Math.round( resy / 2 );
    }

    // Composite material
    this.compositeMaterial = this.getCompositeMaterial( this.nMips );
    this.compositeMaterial.uniforms[ 'blurTexture1' ].value = this.renderTargetsVertical[ 0 ].texture;
    this.compositeMaterial.uniforms[ 'blurTexture2' ].value = this.renderTargetsVertical[ 1 ].texture;
    this.compositeMaterial.uniforms[ 'blurTexture3' ].value = this.renderTargetsVertical[ 2 ].texture;
    this.compositeMaterial.uniforms[ 'blurTexture4' ].value = this.renderTargetsVertical[ 3 ].texture;
    this.compositeMaterial.uniforms[ 'blurTexture5' ].value = this.renderTargetsVertical[ 4 ].texture;
    this.compositeMaterial.uniforms[ 'bloomStrength' ].value = strength;
    this.compositeMaterial.uniforms[ 'bloomRadius' ].value = 0.1;
    this.compositeMaterial.needsUpdate = true;

    var bloomFactors = [ 1.0, 0.8, 0.6, 0.4, 0.2 ];
    this.compositeMaterial.uniforms[ 'bloomFactors' ].value = bloomFactors;
    this.bloomTintColors = [ new THREE.Vector3( 1, 1, 1 ), new THREE.Vector3( 1, 1, 1 ), new THREE.Vector3( 1, 1, 1 ), new THREE.Vector3( 1, 1, 1 ), new THREE.Vector3( 1, 1, 1 ) ];
    this.compositeMaterial.uniforms[ 'bloomTintColors' ].value = this.bloomTintColors;

    // copy material
    var copyShader = CopyShader;
    this.copyUniforms = THREE.UniformsUtils.clone( copyShader.uniforms );
    this.copyUniforms[ 'opacity' ].value = 1.0;
    this.materialCopy = new THREE.ShaderMaterial( {
      uniforms: this.copyUniforms,
      vertexShader: copyShader.vertexShader,
      fragmentShader: copyShader.fragmentShader,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true
    } );

    this.enabled = true;
    this.needsSwap = false;
    this._oldClearColor = new THREE.Color();
    this.oldClearAlpha = 1;
    this.basic = new THREE.MeshBasicMaterial();
    this.fsQuad = new FullScreenQuad( null );
  }
  UnrealBloomPassClass.prototype = Object.create( Pass.prototype );
  UnrealBloomPassClass.prototype.constructor = UnrealBloomPassClass;

  UnrealBloomPassClass.prototype.dispose = function () {
    for ( var i = 0; i < this.renderTargetsHorizontal.length; i ++ ) {
      this.renderTargetsHorizontal[ i ].dispose();
    }
    for ( var i = 0; i < this.renderTargetsVertical.length; i ++ ) {
      this.renderTargetsVertical[ i ].dispose();
    }
    this.renderTargetBright.dispose();
    for ( var i = 0; i < this.separableBlurMaterials.length; i ++ ) {
      this.separableBlurMaterials[ i ].dispose();
    }
    this.compositeMaterial.dispose();
    this.materialCopy.dispose();
    this.basic.dispose();
    this.fsQuad.dispose();
  };

  UnrealBloomPassClass.prototype.setSize = function ( width, height ) {
    var resx = Math.round( width / 2 );
    var resy = Math.round( height / 2 );
    this.renderTargetBright.setSize( resx, resy );
    for ( var i = 0; i < this.nMips; i ++ ) {
      this.renderTargetsHorizontal[ i ].setSize( resx, resy );
      this.renderTargetsVertical[ i ].setSize( resx, resy );
      this.separableBlurMaterials[ i ].uniforms[ 'texSize' ].value = new THREE.Vector2( resx, resy );
      resx = Math.round( resx / 2 );
      resy = Math.round( resy / 2 );
    }
  };

  UnrealBloomPassClass.prototype.render = function ( renderer, writeBuffer, readBuffer, deltaTime, maskActive ) {
    renderer.getClearColor( this._oldClearColor );
    this.oldClearAlpha = renderer.getClearAlpha();
    var oldAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setClearColor( this.clearColor, 0 );
    if ( maskActive ) renderer.state.buffers.stencil.setTest( false );

    // Render input to screen
    if ( this.renderToScreen ) {
      this.fsQuad.material = this.basic;
      this.basic.map = readBuffer.texture;
      renderer.setRenderTarget( null );
      renderer.clear();
      this.fsQuad.render( renderer );
    }

    // 1. Extract Bright Areas
    this.highPassUniforms[ 'tDiffuse' ].value = readBuffer.texture;
    this.highPassUniforms[ 'luminosityThreshold' ].value = this.threshold;
    this.fsQuad.material = this.materialHighPassFilter;
    renderer.setRenderTarget( this.renderTargetBright );
    renderer.clear();
    this.fsQuad.render( renderer );

    // 2. Blur All the mips progressively
    var inputRenderTarget = this.renderTargetBright;
    for ( var i = 0; i < this.nMips; i ++ ) {
      this.fsQuad.material = this.separableBlurMaterials[ i ];
      this.separableBlurMaterials[ i ].uniforms[ 'colorTexture' ].value = inputRenderTarget.texture;
      this.separableBlurMaterials[ i ].uniforms[ 'direction' ].value = UnrealBloomPassClass.BlurDirectionX;
      renderer.setRenderTarget( this.renderTargetsHorizontal[ i ] );
      renderer.clear();
      this.fsQuad.render( renderer );

      this.separableBlurMaterials[ i ].uniforms[ 'colorTexture' ].value = this.renderTargetsHorizontal[ i ].texture;
      this.separableBlurMaterials[ i ].uniforms[ 'direction' ].value = UnrealBloomPassClass.BlurDirectionY;
      renderer.setRenderTarget( this.renderTargetsVertical[ i ] );
      renderer.clear();
      this.fsQuad.render( renderer );

      inputRenderTarget = this.renderTargetsVertical[ i ];
    }

    // Composite All the mips
    this.fsQuad.material = this.compositeMaterial;
    this.compositeMaterial.uniforms[ 'bloomStrength' ].value = this.strength;
    this.compositeMaterial.uniforms[ 'bloomRadius' ].value = this.radius;
    this.compositeMaterial.uniforms[ 'bloomTintColors' ].value = this.bloomTintColors;
    renderer.setRenderTarget( this.renderTargetsHorizontal[ 0 ] );
    renderer.clear();
    this.fsQuad.render( renderer );

    // Blend it additively over the input texture
    this.fsQuad.material = this.materialCopy;
    this.copyUniforms[ 'tDiffuse' ].value = this.renderTargetsHorizontal[ 0 ].texture;
    if ( maskActive ) renderer.state.buffers.stencil.setTest( true );

    if ( this.renderToScreen ) {
      renderer.setRenderTarget( null );
      this.fsQuad.render( renderer );
    } else {
      renderer.setRenderTarget( readBuffer );
      this.fsQuad.render( renderer );
    }

    // Restore renderer settings
    renderer.setClearColor( this._oldClearColor, this.oldClearAlpha );
    renderer.autoClear = oldAutoClear;
  };

  UnrealBloomPassClass.prototype.getSeperableBlurMaterial = function ( kernelRadius ) {
    return new THREE.ShaderMaterial( {
      defines: {
        'KERNEL_RADIUS': kernelRadius,
        'SIGMA': kernelRadius
      },
      uniforms: {
        'colorTexture': { value: null },
        'texSize': { value: new THREE.Vector2( 0.5, 0.5 ) },
        'direction': { value: new THREE.Vector2( 0.5, 0.5 ) }
      },
      vertexShader:
        `varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }`,
      fragmentShader:
        `#include <common>
        varying vec2 vUv;
        uniform sampler2D colorTexture;
        uniform vec2 texSize;
        uniform vec2 direction;
        float gaussianPdf(in float x, in float sigma) {
          return 0.39894 * exp( -0.5 * x * x/( sigma * sigma))/sigma;
        }
        void main() {
          vec2 invSize = 1.0 / texSize;
          float fSigma = float(SIGMA);
          float weightSum = gaussianPdf(0.0, fSigma);
          vec3 diffuseSum = texture2D( colorTexture, vUv).rgb * weightSum;
          for( int i = 1; i < KERNEL_RADIUS; i ++ ) {
            float x = float(i);
            float w = gaussianPdf(x, fSigma);
            vec2 uvOffset = direction * invSize * x;
            vec3 sample1 = texture2D( colorTexture, vUv + uvOffset).rgb;
            vec3 sample2 = texture2D( colorTexture, vUv - uvOffset).rgb;
            diffuseSum += (sample1 + sample2) * w;
            weightSum += 2.0 * w;
          }
          gl_FragColor = vec4(diffuseSum/weightSum, 1.0);
        }`
    } );
  };

  UnrealBloomPassClass.prototype.getCompositeMaterial = function ( nMips ) {
    return new THREE.ShaderMaterial( {
      defines: {
        'NUM_MIPS': nMips
      },
      uniforms: {
        'blurTexture1': { value: null },
        'blurTexture2': { value: null },
        'blurTexture3': { value: null },
        'blurTexture4': { value: null },
        'blurTexture5': { value: null },
        'bloomStrength': { value: 1.0 },
        'bloomFactors': { value: null },
        'bloomTintColors': { value: null },
        'bloomRadius': { value: 0.0 }
      },
      vertexShader:
        `varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }`,
      fragmentShader:
        `varying vec2 vUv;
        uniform sampler2D blurTexture1;
        uniform sampler2D blurTexture2;
        uniform sampler2D blurTexture3;
        uniform sampler2D blurTexture4;
        uniform sampler2D blurTexture5;
        uniform float bloomStrength;
        uniform float bloomRadius;
        uniform float bloomFactors[NUM_MIPS];
        uniform vec3 bloomTintColors[NUM_MIPS];
        float lerpBloomFactor(const in float factor) {
          float mirrorFactor = 1.2 - factor;
          return mix(factor, mirrorFactor, bloomRadius);
        }
        void main() {
          gl_FragColor = bloomStrength * ( lerpBloomFactor(bloomFactors[0]) * vec4(bloomTintColors[0], 1.0) * texture2D(blurTexture1, vUv) +
            lerpBloomFactor(bloomFactors[1]) * vec4(bloomTintColors[1], 1.0) * texture2D(blurTexture2, vUv) +
            lerpBloomFactor(bloomFactors[2]) * vec4(bloomTintColors[2], 1.0) * texture2D(blurTexture3, vUv) +
            lerpBloomFactor(bloomFactors[3]) * vec4(bloomTintColors[3], 1.0) * texture2D(blurTexture4, vUv) +
            lerpBloomFactor(bloomFactors[4]) * vec4(bloomTintColors[4], 1.0) * texture2D(blurTexture5, vUv) );
        }`
    } );
  };

  UnrealBloomPassClass.BlurDirectionX = new THREE.Vector2( 1.0, 0.0 );
  UnrealBloomPassClass.BlurDirectionY = new THREE.Vector2( 0.0, 1.0 );

  var UnrealBloomPass = UnrealBloomPassClass;

  // ─── Expose to window ───────────────────────────────────────

  window.CopyShader = CopyShader;
  window.GammaCorrectionShader = GammaCorrectionShader;
  window.ShaderPass = ShaderPass;
  window.EffectComposer = EffectComposer;
  window.RenderPass = RenderPass;
  window.UnrealBloomPass = UnrealBloomPass;

})();
