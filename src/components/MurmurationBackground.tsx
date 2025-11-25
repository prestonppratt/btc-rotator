import { useEffect, useRef } from 'react';

interface Bird {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    maxSpeed: number;
    maxForce: number;
    angle: number;
    angularVelocity: number;
    spiralRadius: number;
    spiralCenterX: number;
    spiralCenterY: number;
    rotationAngle: number;
    rotationSpeed: number;
    zPhase: number;
}

export function MurmurationBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let flock: Bird[] = [];

        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            initFlock();
        };

        const initFlock = () => {
            flock = [];
            const numBirds = 100; // Subtle for background

            for (let i = 0; i < numBirds; i++) {
                flock.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    vx: (Math.random() - 0.5) * 2,
                    vy: (Math.random() - 0.5) * 2,
                    size: 1.5 + Math.random() * 1.5,
                    maxSpeed: 2 + Math.random() * 1.5,
                    maxForce: 0.1,
                    angle: Math.random() * Math.PI * 2,
                    angularVelocity: 0.007 + Math.random() * 0.014,
                    spiralRadius: 50 + Math.random() * 100,
                    spiralCenterX: canvas.width / 2,
                    spiralCenterY: canvas.height / 2,
                    rotationAngle: Math.random() * Math.PI * 2,
                    rotationSpeed: 0.003 + Math.random() * 0.007,
                    zPhase: Math.random() * Math.PI * 2,
                });
            }
        };

        const distance = (bird1: Bird, bird2: Bird) => {
            const dx = bird1.x - bird2.x;
            const dy = bird1.y - bird2.y;
            return Math.sqrt(dx * dx + dy * dy);
        };

        const separate = (bird: Bird) => {
            const desiredSeparation = 25;
            const steer = { x: 0, y: 0 };
            let count = 0;

            for (let other of flock) {
                const d = distance(bird, other);
                if (d > 0 && d < desiredSeparation) {
                    const diff = {
                        x: bird.x - other.x,
                        y: bird.y - other.y
                    };
                    const len = Math.sqrt(diff.x * diff.x + diff.y * diff.y);
                    if (len > 0) {
                        diff.x /= len;
                        diff.y /= len;
                        diff.x /= d;
                        diff.y /= d;
                    }
                    steer.x += diff.x;
                    steer.y += diff.y;
                    count++;
                }
            }

            if (count > 0) {
                steer.x /= count;
                steer.y /= count;
                const len = Math.sqrt(steer.x * steer.x + steer.y * steer.y);
                if (len > 0) {
                    steer.x /= len;
                    steer.y /= len;
                    steer.x *= bird.maxSpeed;
                    steer.y *= bird.maxSpeed;
                    steer.x -= bird.vx;
                    steer.y -= bird.vy;
                    const steerLen = Math.sqrt(steer.x * steer.x + steer.y * steer.y);
                    if (steerLen > bird.maxForce) {
                        steer.x = (steer.x / steerLen) * bird.maxForce;
                        steer.y = (steer.y / steerLen) * bird.maxForce;
                    }
                }
            }

            return steer;
        };

        const align = (bird: Bird) => {
            const neighborDist = 50;
            const sum = { x: 0, y: 0 };
            let count = 0;

            for (let other of flock) {
                const d = distance(bird, other);
                if (d > 0 && d < neighborDist) {
                    sum.x += other.vx;
                    sum.y += other.vy;
                    count++;
                }
            }

            if (count > 0) {
                sum.x /= count;
                sum.y /= count;
                const len = Math.sqrt(sum.x * sum.x + sum.y * sum.y);
                if (len > 0) {
                    sum.x = (sum.x / len) * bird.maxSpeed;
                    sum.y = (sum.y / len) * bird.maxSpeed;
                    sum.x -= bird.vx;
                    sum.y -= bird.vy;
                    const steerLen = Math.sqrt(sum.x * sum.x + sum.y * sum.y);
                    if (steerLen > bird.maxForce) {
                        sum.x = (sum.x / steerLen) * bird.maxForce;
                        sum.y = (sum.y / steerLen) * bird.maxForce;
                    }
                }
                return sum;
            }
            return { x: 0, y: 0 };
        };

        const cohesion = (bird: Bird) => {
            const neighborDist = 50;
            const sum = { x: 0, y: 0 };
            let count = 0;

            for (let other of flock) {
                const d = distance(bird, other);
                if (d > 0 && d < neighborDist) {
                    sum.x += other.x;
                    sum.y += other.y;
                    count++;
                }
            }

            if (count > 0) {
                sum.x /= count;
                sum.y /= count;
                return seek(bird, sum);
            }
            return { x: 0, y: 0 };
        };

        const seek = (bird: Bird, target: { x: number; y: number }) => {
            const desired = {
                x: target.x - bird.x,
                y: target.y - bird.y
            };
            const len = Math.sqrt(desired.x * desired.x + desired.y * desired.y);
            if (len > 0) {
                desired.x = (desired.x / len) * bird.maxSpeed;
                desired.y = (desired.y / len) * bird.maxSpeed;
                desired.x -= bird.vx;
                desired.y -= bird.vy;
                const steerLen = Math.sqrt(desired.x * desired.x + desired.y * desired.y);
                if (steerLen > bird.maxForce) {
                    desired.x = (desired.x / steerLen) * bird.maxForce;
                    desired.y = (desired.y / steerLen) * bird.maxForce;
                }
            }
            return desired;
        };

        const spiralMotion = (bird: Bird) => {
            const time = Date.now() * 0.001;
            bird.spiralCenterX = canvas.width / 2 + Math.sin(time * 0.35) * 100;
            bird.spiralCenterY = canvas.height / 2 + Math.cos(time * 0.2) * 100;
            
            bird.angle += bird.angularVelocity;
            bird.rotationAngle += bird.rotationSpeed;
            
            const z = Math.sin(time * 0.4 + bird.zPhase) * 150;
            
            const baseX = Math.cos(bird.angle) * bird.spiralRadius;
            const baseY = Math.sin(bird.angle) * bird.spiralRadius;
            
            const cosRot = Math.cos(bird.rotationAngle);
            const sinRot = Math.sin(bird.rotationAngle);
            const rotatedX = baseX * cosRot - baseY * sinRot;
            const rotatedY = baseX * sinRot + baseY * cosRot;
            
            const depthScale = 1 + (z / 400);
            const perspectiveX = rotatedX * depthScale;
            const perspectiveY = rotatedY * depthScale;
            
            const spiralX = bird.spiralCenterX + perspectiveX;
            const spiralY = bird.spiralCenterY + perspectiveY;
            
            const undulation = Math.sin(time * 1.4 + bird.angle) * 30;
            
            return {
                x: spiralX,
                y: spiralY + undulation,
                z: z
            };
        };

        const updateBird = (bird: Bird) => {
            const sep = separate(bird);
            const ali = align(bird);
            const coh = cohesion(bird);
            
            const spiralTarget = spiralMotion(bird);
            const spiral = seek(bird, { x: spiralTarget.x, y: spiralTarget.y });
            
            bird.vx += (sep.x * 1.5 + ali.x * 1.0 + coh.x * 1.0 + spiral.x * 0.3);
            bird.vy += (sep.y * 1.5 + ali.y * 1.0 + coh.y * 1.0 + spiral.y * 0.3);
            
            const speed = Math.sqrt(bird.vx * bird.vx + bird.vy * bird.vy);
            if (speed > bird.maxSpeed) {
                bird.vx = (bird.vx / speed) * bird.maxSpeed;
                bird.vy = (bird.vy / speed) * bird.maxSpeed;
            }
            
            bird.x += bird.vx;
            bird.y += bird.vy;
            
            if (bird.x < 0) bird.x = canvas.width;
            if (bird.x > canvas.width) bird.x = 0;
            if (bird.y < 0) bird.y = canvas.height;
            if (bird.y > canvas.height) bird.y = 0;
        };

        const drawBird = (bird: Bird) => {
            const time = Date.now() * 0.001;
            const z = Math.sin(time * 0.4 + bird.zPhase) * 150;
            
            const normalizedZ = (z + 150) / 300;
            const depthSize = bird.size * (0.6 + normalizedZ * 0.8);
            
            // Light dots on dark background - visible but subtle
            const baseOpacity = 0.2;
            const depthOpacity = baseOpacity + normalizedZ * 0.15; // Range: 0.2 to 0.35
            
            ctx.beginPath();
            ctx.arc(bird.x, bird.y, depthSize, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${depthOpacity})`; // White/light dots
            ctx.fill();
        };

        const animate = () => {
            // Dark background
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            if (flock.length === 0) {
                animationFrameId = requestAnimationFrame(animate);
                return;
            }
            
            for (let bird of flock) {
                updateBird(bird);
                drawBird(bird);
            }
            
            animationFrameId = requestAnimationFrame(animate);
        };

        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();
        animate();

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="fixed top-0 left-0 w-full h-full pointer-events-none"
            style={{ 
                background: 'transparent',
                zIndex: 0,
                position: 'fixed'
            }}
        />
    );
}

