import React, { useState, useEffect, useRef, useCallback } from 'react';

const InfinityBounce = () => {

  const canvasRef = useRef(null);
  const [gameState, setGameState] = useState('menu');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [comboText, setComboText] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 1080, height: 1920});
  const [scaleFactor, setScaleFactor] = useState(1);
  const [menuBall, setMenuBall] = useState({ x: -100, y: -100, vx: 8, vy: 0, rotation: 0, active: false });
  
  const audioContextRef = useRef(null);
  const musicIntervalRef = useRef(null);
  const menuAnimationRef = useRef(null);
  
  const CANVAS_WIDTH = canvasSize.width;
  const CANVAS_HEIGHT = canvasSize.height;
  
  const gameRef = useRef({
    ball: { x: 200, y: 550, width: 48, height: 48, vx: 0, vy: 0, onGround: false, canDoubleJump: false, rotation: 0 },
    platforms: [],
    camera: 0,
    keys: {},
    lastJumpTime: 0,
    lastPlatformY: 600,
    platformCount: 0,
    baseScrollSpeed: 2,
    scrollSpeed: 2.5,
    hasStartedMoving: false,
    bounceAnimation: 0,
    jumpAnimation: 0,
    lastComboTime: 0,
    consecutiveJumps: 0,
    particles: [],
    scale: 1
  });

  const GRAVITY = 0.72;
  const MOVE_SPEED = 10;
  const BASE_JUMP_POWER = -16;
  const PLATFORM_HEIGHT = 25;
  const PLATFORM_GAP = 120; 

  const platformTypes = [
    { name: 'stone', color: '#8b8883ff', jumpModifier: 1, special: null },
    { name: 'wood', color: '#b96529ff', jumpModifier: 0.85,special: null },
    { name: 'ice', color: '#ADD8E6', jumpModifier:0.9,special: 'slippery' },
    { name: 'metal', color: '#B0C4DE', jumpModifier: 1.5, special: null },
    { name: 'glass', color: 'rgba(255, 255, 255, 0.18)', jumpModifier: 1.2, special: 'breakable' }
  ];

  const getPlatformType = (platformNumber) => {
    const typeIndex = Math.floor(platformNumber / 100) % platformTypes.length;
    return platformTypes[typeIndex];
  };

  const generatePlatform = () => {
  const game = gameRef.current;

    game.platformCount++;

    const platformType = getPlatformType(game.platformCount);
    const baseWidth = 80 + Math.random() * 60;
    const width = baseWidth * game.scale;
    const x = Math.random() * (CANVAS_WIDTH - width);

    const isMarker = game.platformCount % 10 === 0;

    game.platforms.push({
      x,
      y: game.lastPlatformY - PLATFORM_GAP,
      width,
      height: PLATFORM_HEIGHT * game.scale,
      type: platformType,
      touched: false,
      timeOnPlatform: 0,
      broken: false,
      spikesUp: false,
      spikeTimer: 0,

      marker: isMarker,
      markerValue: game.platformCount
    });

    game.lastPlatformY -= PLATFORM_GAP;
  };


  const killBall = () => {
    const game = gameRef.current;

    for (let i = 0; i < 40; i++) {
      game.particles.push({
        x: game.ball.x,
        y: game.ball.y,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.5) * 12 - 5,
        life: 1,
        color: `hsl(${Math.random() * 360}, 80%, 60%)`
      });
    }

    setGameState('dying');
    
    setTimeout(() => {
      setGameState('gameover');
      if (score > highScore) setHighScore(score);
    }, 800);
  };

  const playJumpSound = () => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  };

  const playFallSound = () => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.5);
    
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  };

  const startBackgroundMusic = () => {
    if (!audioContextRef.current) return;
    stopBackgroundMusic();
    
    const ctx = audioContextRef.current;
    const melody = [523.25, 587.33, 659.25, 783.99, 659.25, 587.33, 523.25, 587.33];
    let noteIndex = 0;
    
    const playNote = () => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.frequency.value = melody[noteIndex % melody.length];
      osc.type = 'sine';
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
      
      noteIndex++; 
    };
    
    playNote();
    musicIntervalRef.current = setInterval(playNote, 600);
  };

  const stopBackgroundMusic = () => {
    if (musicIntervalRef.current) {
      clearInterval(musicIntervalRef.current);
      musicIntervalRef.current = null;
    }
  };

  const initGame = () => {
    const game = gameRef.current;
    const ballSize = 48 * game.scale;
    game.ball = { 
      x: CANVAS_WIDTH / 3, 
      y: CANVAS_HEIGHT - 250, 
      width: ballSize, 
      height: ballSize, 
      vx: 0, 
      vy: 0, 
      squash: 0, 
      onGround: false, 
      canDoubleJump: false, 
      rotation: 0 
    };
    game.platforms = [];
    game.camera = 0;
    game.lastPlatformY = CANVAS_HEIGHT - 200;
    game.platformCount = 0;
    game.scrollSpeed = 2;
    game.baseScrollSpeed = 3;
    game.hasStartedMoving = false;
    game.bounceAnimation = 0;
    game.jumpAnimation = 0;
    game.lastComboTime = 0;
    game.consecutiveJumps = 0;
    game.particles = [];
    
    if (menuAnimationRef.current) {
      cancelAnimationFrame(menuAnimationRef.current);
      menuAnimationRef.current = null;
    }
    
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    startBackgroundMusic();
    
    game.platforms.push({
      x: 0,
      y: CANVAS_HEIGHT - 220,
      width: CANVAS_WIDTH,
      height: PLATFORM_HEIGHT * game.scale,
      type: platformTypes[0],
      touched: false,
      timeOnPlatform: 0,
      broken: false
    });
    
    for (let i = 0; i < 15; i++) {
      generatePlatform();
    }
    
    setScore(0);
    setCombo(0);
    setComboText('');
    setGameState('playing');
  };

  const jump = (modifier = 1) => {
    const game = gameRef.current;
    if (game.ball.onGround) {
      game.ball.vy = BASE_JUMP_POWER * modifier;
      game.ball.onGround = false;
      game.ball.canDoubleJump = true;
      game.jumpAnimation = 1;
      playJumpSound();
      
      if (!game.hasStartedMoving && game.ball.y < CANVAS_HEIGHT - 250) {
        game.hasStartedMoving = true;
      }
    } else if (game.ball.canDoubleJump) {
      game.ball.vy = BASE_JUMP_POWER * modifier;
      game.ball.canDoubleJump = false;
      game.jumpAnimation = 1;
      playJumpSound();
    }
  };

  const updateCombo = () => {
    const game = gameRef.current;
    const now = Date.now();
    
    if (now - game.lastComboTime < 750) {
      game.consecutiveJumps++;
    } else {
      game.consecutiveJumps = 1;
    }
    
    game.lastComboTime = now;
    
    let comboBonus = 0;
    let comboMsg = '';
    
    if (game.consecutiveJumps >= 6) {
      comboMsg = 'AMAZING!';
      comboBonus = 60;
    } else if (game.consecutiveJumps >= 5) {
      comboMsg = 'GREAT!';
      comboBonus = 30;
    } else if (game.consecutiveJumps >= 4) {
      comboMsg = 'VERY GOOD!';
      comboBonus = 15;
    } else if (game.consecutiveJumps >= 3) {
      comboMsg = 'GOOD!';
      comboBonus = 10;
    }
    
    if (comboMsg) {
      setComboText(comboMsg);
      setCombo(game.consecutiveJumps);
      setTimeout(() => setComboText(''), 1000);
    }
    
    return comboBonus;
  };

  const gameLoop = useCallback(() => {
    if (gameState === 'gameover') {
      return;
    }
    
    if (gameState === 'dying') {
      const game = gameRef.current;
      game.particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.3;
        p.life -= 0.02;
      });
      game.particles = game.particles.filter(p => p.life > 0);
      
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      let canWidth = canvas.width;
      let canHeight = canvas.height;
      
      const gradientBg = ctx.createRadialGradient(-canWidth * 0, -canHeight * 0.1, 25, 2, 2, Math.max(canWidth, canHeight) / 1.5);
      gradientBg.addColorStop(0, '#a280d9ff');
      gradientBg.addColorStop(1, '#5630b1ff');
      ctx.fillStyle = gradientBg;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      game.platforms.forEach(platform => {
        if (platform.broken) return;
        const y = platform.y - game.camera;
        ctx.fillStyle = platform.type.color;
        ctx.fillRect(platform.x, y, platform.width, platform.height);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.strokeRect(platform.x, y, platform.width, platform.height);
      });
      
      game.particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        const pY = p.y - game.camera;
        ctx.fillRect(p.x - 3, pY - 3, 6, 6);
        ctx.globalAlpha = 1;
      });
      
      return;
    }
    
    const game = gameRef.current;
    const ball = game.ball;

    game.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.3;
      p.life -= 0.02;
    });

    game.particles = game.particles.filter(p => p.life > 0);
    
    if (game.keys['ArrowLeft']) ball.vx = -MOVE_SPEED;
    else if (game.keys['ArrowRight']) ball.vx = MOVE_SPEED;
    else ball.vx *= 0.8;
    
    ball.vy += GRAVITY;
    ball.x += ball.vx;
    ball.y += ball.vy;
    
    if (Math.abs(ball.vx) > 0.5) {
      ball.rotation += ball.vx * 0.05;
    }
    
    if (ball.x < ball.width / 2) {
      ball.x = ball.width / 2;
      ball.vx = 0;
      ball.squash = 1;
    }
    if (ball.x > CANVAS_WIDTH - ball.width / 2) {
      ball.x = CANVAS_WIDTH - ball.width / 2;
      ball.vx = 0;
      ball.squash = 1;
    }
    
    if (game.jumpAnimation > 0) game.jumpAnimation -= 0.1;
    if (game.bounceAnimation > 0) game.bounceAnimation -= 0.15;

    ball.onGround = false;

    for (let i = 0; i < game.platforms.length; i++) {
      const platform = game.platforms[i];
      if (platform.broken) continue;

      const ballBottom = ball.y + ball.height / 2;
      const ballLeft = ball.x - ball.width / 2;
      const ballRight = ball.x + ball.width / 2;
      const platTop = platform.y;
      const platLeft = platform.x;
      const platRight = platform.x + platform.width;

      const horizontalOverlap = ballRight > platLeft && ballLeft < platRight;

      if (horizontalOverlap && ball.vy >= 0 && ballBottom >= platTop && ballBottom <= platTop + 18) {
        ball.y = platTop - ball.height / 2;
        ball.vy = 0;
        ball.onGround = true;
        
        if (platform.type.name === 'metal') {
          platform.spikeTimer += 0.016;

          if (platform.spikeTimer > 0.3) {
            platform.spikesUp = true;
          }

          if (platform.spikeTimer > 0.6) {
            killBall();
            return;
          }
        } else {
          platform.spikeTimer = 0;
          platform.spikesUp = false;
        }

        if (game.bounceAnimation <= 0) {
          game.bounceAnimation = 1;
        }

        if (!platform.touched) {
          platform.touched = true;
          const comboBonus = updateCombo();
          setScore(s => s + 10 + comboBonus);
        }

        if (platform.type.special === 'slippery') {
          platform.timeOnPlatform += 0.0006;
          if (platform.timeOnPlatform > 0) {
            ball.vx += ((Math.random() - 0.3) * 2);
          }
        } else if (platform.type.special === 'breakable') {
          platform.timeOnPlatform += 0.016;
          if (platform.timeOnPlatform > 0.6) {
            platform.broken = true;
            ball.onGround = false;
          }
        } else {
          platform.timeOnPlatform = 0;
        }

        break;
      }
    }

    if (game.hasStartedMoving) {
      game.camera -= game.scrollSpeed;
      const speedTier = Math.floor(game.platformCount / 100);
      game.scrollSpeed = game.baseScrollSpeed * Math.pow(1.2, speedTier);
    }
    
    if (game.platforms[game.platforms.length - 1].y - game.camera > -200) {
      generatePlatform();
    }
    
    game.platforms = game.platforms.filter(p => p.y - game.camera < CANVAS_HEIGHT + 100);
    
    if (ball.y - game.camera > CANVAS_HEIGHT || ball.y - game.camera < -100) {
      playFallSound();
      stopBackgroundMusic();
      killBall();
      return;
    }
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let canWidth = canvas.width;
    let canHeight = canvas.height;
    const gradientBg = ctx.createRadialGradient(-canWidth * 0, -canHeight * 0.1, 25, 2, 2, Math.max(canWidth, canHeight) / 1.5);
    gradientBg.addColorStop(0, '#a280d9ff');
    gradientBg.addColorStop(1, '#5630b1ff');
    ctx.fillStyle = gradientBg;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    game.platforms.forEach(platform => {
      if (platform.broken) return;
      
      const y = platform.y - game.camera;
      ctx.fillStyle = platform.type.color;
      ctx.fillRect(platform.x, y, platform.width, platform.height);
      
      if (platform.spikesUp) {
        ctx.fillStyle = '#555';
        const spikeCount = Math.floor(platform.width / 12);
        for (let i = 0; i < spikeCount; i++) {
          const sx = platform.x + i * 12;
          ctx.beginPath();
          ctx.moveTo(sx, y);
          ctx.lineTo(sx + 6, y - 14);
          ctx.lineTo(sx + 12, y);
          ctx.fill();
        }
      }
      
      if (platform.type.name === 'stone') {
        ctx.fillStyle = 'rgba(32, 31, 31, 0.2)';
        for (let i = 0; i < platform.width / 2.4; i++) {
          const px = platform.x + Math.random() * platform.width;
          const py = y + Math.random() * platform.height;
          ctx.fillRect(px, py, 4, 4);
        }
        ctx.fillStyle = 'rgba(51, 47, 47, 0.1)';
        for (let i = 0; i < platform.width / 15; i++) {
          const px = platform.x + Math.random() * platform.width;
          const py = y + Math.random() * platform.height;
          ctx.fillRect(px, py, 2, 2);
        }
      } else if (platform.type.name === 'wood') {
        ctx.strokeStyle = 'rgba(50, 26, 2, 0.6)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          const lineY = y + (i + 1) * (platform.height / 4);
          ctx.beginPath();
          ctx.moveTo(platform.x, lineY);
          ctx.lineTo(platform.x + platform.width, lineY);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(54, 34, 13, 0.9)';
        for (let i = 0; i < platform.width / 63; i++) {
          const kx = platform.x + (i + 0.5) * 40 + (Math.random() - 0.5) * 20;
          const ky = y + platform.height / 2;
          ctx.beginPath();
          ctx.ellipse(kx, ky, 3, 2, 0, 0, Math.PI * 3);
          ctx.fill();
        }
      } else if (platform.type.name === 'metal') {
        const metalGrad = ctx.createLinearGradient(platform.x, y, platform.x, y + platform.height);
        metalGrad.addColorStop(0, 'rgba(255, 252, 252, 0.93)');
        metalGrad.addColorStop(0.5, 'rgba(65, 59, 59, 0.64)');
        metalGrad.addColorStop(1, 'rgba(0, 0, 0, 0.73)');
        ctx.fillStyle = metalGrad;
        ctx.fillRect(platform.x, y, platform.width, platform.height);
        
        ctx.fillStyle = 'rgba(80, 80, 80, 0.81)';
        for (let i = 0; i < platform.width / 25; i++) {
          const rx = platform.x + 0.5 + i * 25;
          ctx.beginPath();
          ctx.arc(rx, y + platform.height / 2, 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(212, 202, 202, 0.84)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      } else if (platform.type.name === 'glass') {
        const glassGrad = ctx.createLinearGradient(platform.x, y, platform.x, y + platform.height);
        glassGrad.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
        glassGrad.addColorStop(0.3, 'rgba(255, 255, 255, 0.6)');
        glassGrad.addColorStop(1, 'rgba(200, 240, 255, 0.3)');
        ctx.fillStyle = glassGrad;
        ctx.fillRect(platform.x, y, platform.width, platform.height);
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillRect(platform.x + 2, y + 2, platform.width * 0.3, 3);
        
        if (platform.timeOnPlatform > 0.1) {
          ctx.strokeStyle = '#5a7d80ff';
          ctx.lineWidth = 2;
          ctx.strokeRect(platform.x, y, platform.width, platform.height);
          ctx.beginPath();
          ctx.moveTo(platform.x + platform.width / 2, y);
          ctx.lineTo(platform.x + platform.width / 2 - 5, y + platform.height);
          ctx.moveTo(platform.x + platform.width / 2, y);
          ctx.lineTo(platform.x + platform.width / 2 + 5, y + platform.height);
          ctx.stroke();
        }
      } else if (platform.type.name === 'ice') {
        const iceGrad = ctx.createLinearGradient(platform.x, y, platform.x + platform.width, y + platform.height);
        iceGrad.addColorStop(0, 'rgba(225, 225, 225, 0.6)');
        iceGrad.addColorStop(0.5, 'rgba(91, 171, 197, 0.6)');
        iceGrad.addColorStop(1, 'rgba(255, 255, 255, 0.2)');
        ctx.fillStyle = iceGrad;
        ctx.fillRect(platform.x, y, platform.width, platform.height);
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.99)';
        ctx.lineWidth = 1;
        for (let i = 0; i < platform.width / 24; i++) {
          const cx = platform.x + i * 20 + 10;
          const cy = y + platform.height / 2;
          ctx.beginPath();
          ctx.moveTo(cx - 4, cy);
          ctx.lineTo(cx + 4, cy);
          ctx.moveTo(cx, cy - 4);
          ctx.lineTo(cx, cy + 4);
          ctx.stroke();
        }
      }
      
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.strokeRect(platform.x, y, platform.width, platform.height);

      if (platform.marker) {
        const boxSize = 45 * game.scale;
        const boxX = platform.x + platform.width / 2 - boxSize / 2;
        const boxY = y + platform.height + 8;

        ctx.fillStyle = '#FFD700';
        ctx.fillRect(boxX, boxY, boxSize, boxSize);

        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(boxX, boxY, boxSize, boxSize);

        ctx.fillStyle = '#000';
        ctx.font = `bold ${16 * game.scale}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          platform.markerValue,
          boxX + boxSize / 2,
          boxY + boxSize / 2
        );

        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }
    });
    
    const ballY = ball.y - game.camera;
    let ballWidth = ball.width;
    let ballHeight = ball.height;
    
    if (ball.squash > 0) {
      ballWidth *= 0.4;
      ballHeight *= 1.6;
      ball.squash -= 0.9;
    }
    
    if (game.jumpAnimation > 0) {
      const baseWidth = ball.width;
      const baseHeight = ball.height;
      ballWidth = baseWidth * 0.69 + (baseWidth * 0.17 * (1 - game.jumpAnimation));
      ballHeight = baseHeight * 1.31 - (baseHeight * 0.17 * (1 - game.jumpAnimation));
    } else if (game.bounceAnimation > 0) {
      const baseWidth = ball.width;
      const baseHeight = ball.height;
      ballWidth = baseWidth + (baseWidth * 0.17 * game.bounceAnimation);
      ballHeight = baseHeight - (baseHeight * 0.17 * game.bounceAnimation);
    }
    
    ctx.save();
    ctx.translate(ball.x, ballY);
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(0, ballHeight / 2 + 4, ballWidth / 2, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    
    const gradient = ctx.createRadialGradient(-ballWidth * 0.2, -ballHeight * 0.2, 5, 0, 0, Math.max(ballWidth, ballHeight) / 2);
    gradient.addColorStop(0, '#90EE90');
    gradient.addColorStop(1, '#228B22');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(0, 0, ballWidth / 2, ballHeight / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#d3fdbdff';
    ctx.beginPath();
    ctx.ellipse(-ballWidth * 0.15, -ballHeight * 0.15, ballWidth * 0.25, ballHeight * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    const CROSS_SCALE = 0.12;
    ctx.save();
    ctx.rotate(ball.rotation);
    ctx.strokeStyle = '#006400';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-ballWidth * CROSS_SCALE, 0);
    ctx.lineTo(ballWidth * CROSS_SCALE, 0);
    ctx.moveTo(0, -ballHeight * CROSS_SCALE);
    ctx.lineTo(0, ballHeight * CROSS_SCALE);
    ctx.stroke();
    ctx.restore();
    
    ctx.restore();

    game.particles.forEach(p => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      const pY = p.y - game.camera;
      ctx.fillRect(p.x - 3, pY - 3, 6, 6);
      ctx.globalAlpha = 1;
    });
    
    const fontSize = Math.max(16, CANVAS_WIDTH / 25);
    ctx.fillStyle = 'white';
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.fillText(`Score: ${score}`, 10, 30);
    ctx.fillText(`Combo: ${combo}`, 10, 60);
    
    if (comboText) {
      const comboFontSize = Math.max(24, CANVAS_WIDTH / 18);
      ctx.font = `bold ${comboFontSize}px Arial`;
      ctx.fillStyle = '#FFD700';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 6;
      const textWidth = ctx.measureText(comboText).width;
      ctx.strokeText(comboText, CANVAS_WIDTH / 2 - textWidth / 2, 100);
      ctx.fillText(comboText, CANVAS_WIDTH / 2 - textWidth / 2, 100);
    }
    
    const currentType = getPlatformType(Math.floor(game.platformCount / 100) * 100);
    const infoFontSize = Math.max(12, CANVAS_WIDTH / 37);
    ctx.font = `${infoFontSize}px Arial`;
    ctx.fillText(`Platform: ${currentType.name.toUpperCase()}`, 10, CANVAS_HEIGHT - 10);
    
  }, [gameState, score, highScore, combo, comboText, CANVAS_WIDTH, CANVAS_HEIGHT]);

  useEffect(() => {
    const updateCanvasSize = () => {
      const isMobileView = window.innerWidth <= 768;
      const maxWidth = window.innerWidth - 32;
      const maxHeight = window.innerHeight - (isMobileView ? 100 : 200);
      
      let width, height, scale;
      
      if (isMobileView) {
        width = Math.min(maxWidth, 450);
        height = maxHeight;
        scale = 0.7;
      } else {
        width = 720;
        height = 960;
        scale = 1;
        
        if (maxWidth < 720) {
          width = maxWidth;
          height = (maxWidth / 720) * 960;
        }
        
        if (height > maxHeight) {
          height = maxHeight;
          width = (maxHeight / 960) * 720;
        }
      }
      
      setCanvasSize({ width: Math.floor(width), height: Math.floor(height) });
      setScaleFactor(scale);
      gameRef.current.scale = scale;
    };
    
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const interval = setInterval(gameLoop, 1000 / 60);
    return () => clearInterval(interval);
  }, [gameLoop]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      gameRef.current.keys[e.code] = true;
      if (e.code === 'Space' && gameState === 'playing') {
        e.preventDefault();
        const platform = gameRef.current.platforms.find(p => {
          const ballBottom = gameRef.current.ball.y + gameRef.current.ball.height / 2;
          return ballBottom >= p.y && ballBottom <= p.y + p.height;
        });
        
        const jumpMod = platform ? platform.type.jumpModifier : 1;
        jump(jumpMod);
      }
    };
    
    const handleKeyUp = (e) => {
      gameRef.current.keys[e.code] = false;
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState]);

  useEffect(() => {
    return () => {
      stopBackgroundMusic();
      if (menuAnimationRef.current) {
        cancelAnimationFrame(menuAnimationRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (gameState !== 'menu') {
      if (menuAnimationRef.current) {
        cancelAnimationFrame(menuAnimationRef.current);
        menuAnimationRef.current = null;
      }
      return;
    }

    let animationState = 'waiting';
    let waitTime = 0;
    const WAIT_DURATION = 120;
    let bounceCount = 0;
    const ballSize = 48 * scaleFactor;
    const titleY = CANVAS_HEIGHT * 0.4;
    const titleHeight = isMobile ? 24 : 36;
    
    const animateMenuBall = () => {
      setMenuBall(prev => {
        let newBall = { ...prev };

        if (animationState === 'waiting') {
          waitTime++;
          if (waitTime >= WAIT_DURATION) {
            animationState = 'animating';
            bounceCount = 0;
            waitTime = 0;
            newBall = {
              x: -ballSize,
              y: titleY - 150,
              vx: 8,
              vy: 2,
              rotation: 0,
              active: true,
              squash: 0
            };
          }
          return newBall;
        }

        if (animationState === 'animating') {
          newBall.vy += 0.6;
          newBall.x += newBall.vx;
          newBall.y += newBall.vy;
          newBall.rotation += newBall.vx * 0.05;

          if (newBall.squash > 0) {
            newBall.squash -= 0.15;
          }

          if (newBall.y + ballSize / 2 >= titleY && 
              newBall.y + ballSize / 2 <= titleY + titleHeight + 20 && 
              newBall.vy > 0) {
            newBall.y = titleY - ballSize / 2;
            newBall.vy = -Math.abs(newBall.vy) * 0.7;
            newBall.squash = 1;
            bounceCount++;

            if (bounceCount >= 2 + Math.floor(Math.random() * 2)) {
              newBall.vx = 12;
            }
          }

          if (newBall.x > CANVAS_WIDTH + ballSize) {
            animationState = 'waiting';
            waitTime = 0;
            newBall.active = false;
          }

          return newBall;
        }

        return newBall;
      });

      menuAnimationRef.current = requestAnimationFrame(animateMenuBall);
    };

    menuAnimationRef.current = requestAnimationFrame(animateMenuBall);

    return () => {
      if (menuAnimationRef.current) {
        cancelAnimationFrame(menuAnimationRef.current);
      }
    };
  }, [gameState, CANVAS_HEIGHT, CANVAS_WIDTH, scaleFactor, isMobile]);

  const handleMobileMove = (direction) => {
    gameRef.current.keys[direction] = true;
    setTimeout(() => {
      gameRef.current.keys[direction] = false;
    }, 100);
  };

  const handleMobileJump = () => {
    if (gameState === 'playing') {
      const platform = gameRef.current.platforms.find(p => {
        const ballBottom = gameRef.current.ball.y + gameRef.current.ball.height / 2;
        return ballBottom >= p.y - gameRef.current.camera && 
               ballBottom <= p.y + p.height - gameRef.current.camera;
      });
      
      const jumpMod = platform ? platform.type.jumpModifier : 1;
      jump(jumpMod);
    }
  };

  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      width: '100vw',
      background: 'linear-gradient(to bottom, #411265ff, #5d0d9eff)',
      padding: '8px',
      fontFamily: 'Arial, sans-serif',
      boxSizing: 'border-box',
      overflow: 'hidden'
    },
    header: {
      marginBottom: '8px',
      width: '100%',
      textAlign: 'center'
    },
    title: {
      fontSize: isMobile ? '24px' : '36px',
      fontWeight: 'bold',
      color: 'white',
      textAlign: 'center',
      marginBottom: '4px',
      margin: 0
    },
    highScore: {
      color: 'white',
      textAlign: 'center',
      fontSize: isMobile ? '14px' : '18px',
      margin: 0
    },
    canvasContainer: {
      position: 'relative',
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    },
    canvas: {
      border: '4px solid #c084fc',
      borderRadius: '8px',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      maxWidth: '100%',
      height: 'auto',
      display: 'block'
    },
    overlay: {
      position: 'absolute',
      width: '100%',
      height: '100%',
      inset: '0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      borderRadius: '8px'
    },
    overlayTitle: {
      fontSize: isMobile ? '24px' : '30px',
      fontWeight: 'bold',
      color: 'white',
      marginBottom: '16px'
    },
    overlayText: {
      color: 'white',
      marginBottom: '8px',
      fontSize: isMobile ? '14px' : '16px'
    },
    overlayScore: {
      color: 'white',
      fontSize: isMobile ? '18px' : '20px',
      marginBottom: '8px'
    },
    button: {
      padding: isMobile ? '10px 24px' : '12px 32px',
      backgroundColor: '#22c55e',
      color: 'white',
      fontWeight: 'bold',
      borderRadius: '8px',
      border: 'none',
      cursor: 'pointer',
      fontSize: isMobile ? '14px' : '16px',
      transition: 'background-color 0.3s'
    },
    controls: {
      width: '100%',
      maxWidth: `${canvasSize.width}px`,
      marginTop: '12px',
      display: 'flex',
      justifyContent: 'space-between',
      padding: '0 8px',
      boxSizing: 'border-box'
    },
    controlGroup: {
      display: 'flex',
      gap: '8px'
    },
    controlButton: {
      padding: isMobile ? '14px 20px' : '16px 24px',
      backgroundColor: '#a855f7',
      color: 'white',
      fontWeight: 'bold',
      borderRadius: '8px',
      border: 'none',
      cursor: 'pointer',
      fontSize: isMobile ? '16px' : '18px',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      touchAction: 'manipulation'
    },
    jumpButton: {
      padding: isMobile ? '14px 28px' : '16px 32px',
      backgroundColor: '#22c55e',
      color: 'white',
      fontWeight: 'bold',
      borderRadius: '8px',
      border: 'none',
      cursor: 'pointer',
      fontSize: isMobile ? '16px' : '18px',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      touchAction: 'manipulation'
    }
  };

  return (
    <div style={styles.container}>
      
      <div style={styles.canvasContainer}>
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          style={styles.canvas}
        />
        
        {gameState === 'menu' && (
          <div style={styles.overlay}>
            <h2 style={styles.overlayTitle}>The Infinity Bounce</h2>
            <p style={styles.overlayText}>Use Arrow Keys to Move</p>
            <p style={styles.overlayText}>Press Space to Jump</p>
            <button
              onClick={initGame}
              onKeyDown={(e) => e.key === 'Enter' && initGame()}
              style={styles.button}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#16a34a'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#22c55e'}
            >
              Start Game
            </button>
            
            {menuBall.active && (() => {
              const ballSize = 48 * scaleFactor;
              let displayWidth = ballSize;
              let displayHeight = ballSize;
              
              if (menuBall.squash > 0) {
                displayWidth = ballSize * (1 + 0.3 * menuBall.squash);
                displayHeight = ballSize * (1 - 0.3 * menuBall.squash);
              }
              
              return (
                <div
                  style={{
                    position: 'absolute',
                    left: `${(menuBall.x / CANVAS_WIDTH) * 100}%`,
                    top: `${(menuBall.y / CANVAS_HEIGHT) * 100}%`,
                    width: `${displayWidth}px`,
                    height: `${displayHeight}px`,
                    transform: `translate(-50%, -50%) rotate(${menuBall.rotation}rad)`,
                    pointerEvents: 'none',
                    zIndex: 10
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: '50%',
                      width: `${displayWidth * 0.8}px`,
                      height: '8px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      borderRadius: '50%',
                      transform: 'translate(-50%, 4px)',
                      filter: 'blur(4px)'
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: '50%',
                      width: '100%',
                      height: '100%',
                      transform: 'translate(-50%, -50%)',
                      background: 'radial-gradient(circle at 30% 30%, #90EE90, #228B22)',
                      borderRadius: '50%',
                      boxShadow: 'inset -5px -5px 15px rgba(0,0,0,0.3)'
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        left: '25%',
                        top: '20%',
                        width: '35%',
                        height: '30%',
                        background: '#d3fdbdff',
                        borderRadius: '50%',
                        opacity: 0.8
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        width: '4px',
                        height: '24%',
                        background: '#006400',
                        transform: 'translate(-50%, -50%)',
                        borderRadius: '2px'
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        width: '24%',
                        height: '4px',
                        background: '#006400',
                        transform: 'translate(-50%, -50%)',
                        borderRadius: '2px'
                      }}
                    />
                  </div>
                </div>
              );
            })()}
          </div>
        )}
        
        {gameState === 'gameover' && (
          <div style={styles.overlay}>
            <h2 style={{...styles.overlayTitle, color: '#ef4444'}}>Game Over!</h2>
            <p style={styles.overlayScore}>Score: {score}</p>
            <p style={styles.overlayScore}>High Score: {highScore}</p>
            <button
              onKeyDown={(e) => e.key === 'Enter' && initGame()}
              onClick={initGame}
              style={styles.button}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#16a34a'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#22c55e'}
            >
              Play Again
            </button>
          </div>
        )}
      </div>
      
      {isMobile && (
        <div style={styles.controls}>
          <div style={styles.controlGroup}>
            <button
              onTouchStart={() => handleMobileMove('ArrowLeft')}
              onMouseDown={() => handleMobileMove('ArrowLeft')}
              style={styles.controlButton}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#9333ea'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#a855f7'}
            >
              ⬅️
            </button>
            <button
              onTouchStart={() => handleMobileMove('ArrowRight')}
              onMouseDown={() => handleMobileMove('ArrowRight')}
              style={styles.controlButton}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#9333ea'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#a855f7'}
            >
              ➡️
            </button>
          </div>
          <button
            onTouchStart={handleMobileJump}
            onMouseDown={handleMobileJump}
            style={styles.jumpButton}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#16a34a'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#22c55e'}
          >
            ⬆️
          </button>
        </div>
      )}
      
    </div>
  );
};

export default InfinityBounce;
