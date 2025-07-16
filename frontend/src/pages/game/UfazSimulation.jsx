import React, { useState, useRef, useCallback, Suspense, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { 
  OrbitControls, 
  useGLTF, 
  Text, 
  Html, 
  Sky, 
  Environment,
  PerspectiveCamera,
  KeyboardControls,
  useKeyboardControls,
  PointerLockControls
} from '@react-three/drei';
import { Vector3 } from 'three';
import { useNavigate } from 'react-router-dom';

// Simple Game UI - just instructions
function GameUI({ showMenu, onToggleMenu, onExitGame }) {
  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-10">
      {/* Top HUD */}
      <div className="absolute top-4 left-4 bg-black bg-opacity-80 text-white p-4 rounded-lg pointer-events-auto backdrop-blur-sm border border-blue-500/30">
        <h3 className="text-lg font-bold text-blue-400 mb-2">🏛️ Ufaz University Simulation</h3>
        <div className="text-sm">
          <div className="text-gray-300">Welcome to Ufaz University Campus</div>
        </div>
      </div>

      {/* Movement Instructions */}
      <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 text-white p-3 rounded-lg pointer-events-auto">
        <div className="text-sm">
          <div><strong>Movement Controls:</strong></div>
          <div>W: Move Forward</div>
          <div>A: Move Left</div>
          <div>S: Move Backward</div>
          <div>D: Move Right</div>
          <div>Space: Jump</div>
          <div>🖱️ Mouse: Look around</div>
          <div>ESC: Open Menu</div>
        </div>
      </div>

      {/* ESC Menu */}
      {showMenu && (
        <div className="absolute inset-0 bg-black bg-opacity-80 flex items-center justify-center pointer-events-auto">
          <div className="bg-gray-900 border border-blue-500/30 rounded-lg p-8 text-white min-w-[300px] backdrop-blur-sm">
            <h2 className="text-2xl font-bold text-blue-400 mb-6 text-center">Game Menu</h2>
            <div className="space-y-4">
              <button
                onClick={onToggleMenu}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                Resume Game
              </button>
              <button
                onClick={onExitGame}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                Exit to Dashboard
              </button>
            </div>
            <div className="mt-6 text-center text-sm text-gray-400">
              Press ESC again to resume
            </div>
          </div>
        </div>
      )}

      {/* Crosshair */}
      {!showMenu && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="w-4 h-4 border-2 border-white rounded-full opacity-70"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full"></div>
        </div>
      )}
    </div>
  );
}

// Player Character Component with FPS controls and physics
function PlayerCharacter({ isMenuOpen }) {
  const meshRef = useRef();
  const { camera } = useThree();
  const [, get] = useKeyboardControls();
  
  // Physics constants
  const speed = 6;
  const jumpForce = 8;
  const gravity = -20;
  const height = 1.8; // Eye level height
  const groundLevel = 0.5; // Player's feet position when on ground
  
  // Physics state
  const velocityY = useRef(0);
  const isGrounded = useRef(true);
  
  useFrame((state, delta) => {
    if (!meshRef.current || isMenuOpen) return;
    
    const { forward, backward, left, right, jump } = get();
    
    // Get camera direction for movement
    const direction = new Vector3();
    camera.getWorldDirection(direction);
    direction.y = 0; // Keep movement on ground level
    direction.normalize();
    
    // Calculate right direction
    const rightDirection = new Vector3();
    rightDirection.crossVectors(direction, new Vector3(0, 1, 0));
    
    // Horizontal movement
    const velocity = new Vector3(0, 0, 0);
    
    if (forward) velocity.add(direction.clone().multiplyScalar(speed * delta));
    if (backward) velocity.add(direction.clone().multiplyScalar(-speed * delta));
    if (left) velocity.add(rightDirection.clone().multiplyScalar(-speed * delta));
    if (right) velocity.add(rightDirection.clone().multiplyScalar(speed * delta));
    
    // Apply horizontal movement
    meshRef.current.position.add(velocity);
    
    // Jumping logic
    if (jump && isGrounded.current) {
      velocityY.current = jumpForce;
      isGrounded.current = false;
    }
    
    // Apply gravity
    velocityY.current += gravity * delta;
    
    // Apply vertical movement
    meshRef.current.position.y += velocityY.current * delta;
    
    // Ground collision detection
    if (meshRef.current.position.y <= groundLevel) {
      meshRef.current.position.y = groundLevel;
      velocityY.current = 0;
      isGrounded.current = true;
    }
    
    // Keep player within bounds (optional - prevents falling off the map)
    const bounds = 18; // Half of the ground size (40/2 - 2 for safety)
    meshRef.current.position.x = Math.max(-bounds, Math.min(bounds, meshRef.current.position.x));
    meshRef.current.position.z = Math.max(-bounds, Math.min(bounds, meshRef.current.position.z));
    
    // Update camera to follow player at eye level (FPS view)
    const playerPosition = meshRef.current.position;
    camera.position.copy(playerPosition);
    camera.position.y = playerPosition.y + height; // Eye level
  });

  return (
    <mesh ref={meshRef} position={[0, groundLevel, 0]} castShadow visible={false}>
      <capsuleGeometry args={[0.3, 1.4]} />
      <meshStandardMaterial color="#4F46E5" />
    </mesh>
  );
}

// Main University Model Component
function UniversityModel() {
  const { scene } = useGLTF('/models/low_poly_building.glb');

  return (
    <group>
      {/* Main university building */}
      <primitive object={scene} scale={[2, 2, 2]} position={[0, 0, 0]} />

      {/* Campus Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#4ADE80" />
      </mesh>

      {/* Main Pathways */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, 0]}>
        <planeGeometry args={[2, 40]} />
        <meshStandardMaterial color="#94A3B8" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, 0]}>
        <planeGeometry args={[40, 2]} />
        <meshStandardMaterial color="#94A3B8" />
      </mesh>

      {/* Elevated Platforms for Jumping Practice */}
      <mesh position={[8, 0.5, 8]} castShadow receiveShadow>
        <boxGeometry args={[3, 1, 3]} />
        <meshStandardMaterial color="#8B5CF6" />
      </mesh>
      
      <mesh position={[-8, 1, -8]} castShadow receiveShadow>
        <boxGeometry args={[2.5, 2, 2.5]} />
        <meshStandardMaterial color="#EF4444" />
      </mesh>
      
      <mesh position={[12, 0.25, -5]} castShadow receiveShadow>
        <boxGeometry args={[2, 0.5, 4]} />
        <meshStandardMaterial color="#F59E0B" />
      </mesh>
      
      <mesh position={[-12, 0.75, 5]} castShadow receiveShadow>
        <boxGeometry args={[3, 1.5, 2]} />
        <meshStandardMaterial color="#10B981" />
      </mesh>

      {/* Stepping Stones */}
      <mesh position={[5, 0.25, -10]} castShadow receiveShadow>
        <cylinderGeometry args={[1, 1, 0.5]} />
        <meshStandardMaterial color="#6366F1" />
      </mesh>
      
      <mesh position={[7, 0.5, -12]} castShadow receiveShadow>
        <cylinderGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#6366F1" />
      </mesh>
      
      <mesh position={[9, 0.75, -14]} castShadow receiveShadow>
        <cylinderGeometry args={[1, 1, 1.5]} />
        <meshStandardMaterial color="#6366F1" />
      </mesh>

      {/* Campus Benches */}
      <mesh position={[4, 0.25, 4]} castShadow receiveShadow>
        <boxGeometry args={[2, 0.5, 0.8]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      
      <mesh position={[-4, 0.25, -4]} castShadow receiveShadow>
        <boxGeometry args={[2, 0.5, 0.8]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>

      {/* Low Walls for Parkour */}
      <mesh position={[0, 0.5, 15]} castShadow receiveShadow>
        <boxGeometry args={[8, 1, 0.5]} />
        <meshStandardMaterial color="#64748B" />
      </mesh>
      
      <mesh position={[15, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 1, 8]} />
        <meshStandardMaterial color="#64748B" />
      </mesh>
    </group>
  );
}

// Loading component
function LoadingScreen() {
  return (
    <Html center>
      <div className="text-white text-xl">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        Loading Ufaz University...
      </div>
    </Html>
  );
}

// Main Simulation Component
export default function UfazSimulation() {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  
  const keyboardMap = [
    { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
    { name: 'backward', keys: ['ArrowDown', 'KeyS'] },
    { name: 'left', keys: ['ArrowLeft', 'KeyA'] },
    { name: 'right', keys: ['ArrowRight', 'KeyD'] },
    { name: 'jump', keys: ['Space'] }
  ];

  // Handle ESC key to toggle menu
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.code === 'Escape') {
        setShowMenu(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleToggleMenu = useCallback(() => {
    setShowMenu(prev => !prev);
  }, []);

  const handleExitGame = useCallback(() => {
    navigate('/dashboard');
  }, [navigate]);

  return (
    <div className="w-full h-screen relative bg-gradient-to-b from-blue-400 to-blue-600" id="canvas-container">
      <KeyboardControls map={keyboardMap}>
        <Canvas
          camera={{ position: [0, 1.8, 5], fov: 75 }}
          shadows
        >
          {/* Lighting */}
          <ambientLight intensity={0.4} />
          <directionalLight 
            position={[10, 10, 5]} 
            intensity={1} 
            castShadow 
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          <pointLight position={[0, 10, 0]} intensity={0.5} />

          {/* Environment */}
          <Sky sunPosition={[100, 20, 100]} />
          <fog attach="fog" args={['#87CEEB', 30, 100]} />

          {/* FPS Controls */}
          {!showMenu && (
            <PointerLockControls 
              selector="#canvas-container"
            />
          )}

          {/* 3D Content */}
          <Suspense fallback={<LoadingScreen />}>
            <UniversityModel />
            <PlayerCharacter isMenuOpen={showMenu} />
          </Suspense>
        </Canvas>
      </KeyboardControls>

      {/* Game UI Overlay */}
      <GameUI 
        showMenu={showMenu}
        onToggleMenu={handleToggleMenu}
        onExitGame={handleExitGame}
      />
    </div>
  );
}