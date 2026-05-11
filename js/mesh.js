// 3D Interactive Mesh Net - Prong Page
// Uses Three.js with WebGL for the triangle mesh that flows like water

let scene, camera, renderer, raycaster;
let meshGroup;
let points = [];
let triangles = [];
let mouse = new THREE.Vector2();
let mouseWorld = new THREE.Vector3();
let isDragging = false;
let dragStart = new THREE.Vector3();
let velocities = [];
let originalPositions = [];

// Configuration
const CONFIG = {
    gridSize: 20,
    spacing: 3,
    waveSpeed: 0.02,
    waveHeight: 0.5,
    interactionRadius: 5,
    springConstant: 0.05,
    damping: 0.95,
    turbulence: 0.01
};

init();
animate();

function init() {
    // Scene setup
    scene = new THREE.Scene();
    
    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 50;
    
    // Renderer
    renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: true,
        powerPreference: "high-performance"
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ReinhardToneMapping;
    renderer.toneMappingExposure = 1.2;
    
    const container = document.getElementById('canvas-container');
    container.appendChild(renderer.domElement);
    
    // Raycaster for mouse interaction
    raycaster = new THREE.Raycaster();
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0x00ffcc, 0.8);
    directionalLight.position.set(50, 50, 50);
    scene.add(directionalLight);
    
    const purpleLight = new THREE.DirectionalLight(0x9d4edd, 0.5);
    purpleLight.position.set(-50, 30, -30);
    scene.add(purpleLight);
    
    // Create the mesh grid
    createTriangleMesh();
    
    // Event listeners
    window.addEventListener('resize', onWindowResize);
    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mouseup', onMouseUp);
    container.addEventListener('mouseleave', onMouseUp);
    
    // Touch events
    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);
}

function createTriangleMesh() {
    meshGroup = new THREE.Group();
    scene.add(meshGroup);
    
    // First create all points
    const pointGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    
    for (let x = 0; x < CONFIG.gridSize; x++) {
        for (let y = 0; y < CONFIG.gridSize; y++) {
            const startX = (x - CONFIG.gridSize / 2) * CONFIG.spacing;
            const startY = (y - CONFIG.gridSize / 2) * CONFIG.spacing;
            
            const material = new THREE.MeshBasicMaterial({
                color: new THREE.Color(0x00ffcc),
                transparent: true,
                opacity: 0.7
            });
            
            const sphere = new THREE.Mesh(pointGeometry, material);
            sphere.position.set(startX, startY, 0);
            meshGroup.add(sphere);
            points.push(sphere);
            
            originalPositions.push({
                x: startX,
                y: startY,
                z: 0
            });
            
            velocities.push(new THREE.Vector3(0, 0, 0));
        }
    }
    
    createTriangleConnections();
    createTriangleFaces();
    createConnectionLines();
}

function createTriangleConnections() {
    for (let i = 0; i < points.length; i++) {
        const connections = [];
        const x = i % CONFIG.gridSize;
        const y = Math.floor(i / CONFIG.gridSize);
        
        // Connect to neighbors
        if (x < CONFIG.gridSize - 1) connections.push(i + 1);
        if (y < CONFIG.gridSize - 1) connections.push(i + CONFIG.gridSize);
        if (x < CONFIG.gridSize - 1 && y < CONFIG.gridSize - 1) {
            connections.push(i + CONFIG.gridSize + 1);
        }
        
        triangles.push(connections);
    }
}

function createTriangleFaces() {
    // Create triangle faces between connected points
    const triangleMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ffcc,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide
    });
    
    for (let i = 0; i < triangles.length; i++) {
        const connections = triangles[i];
        const x = i % CONFIG.gridSize;
        const y = Math.floor(i / CONFIG.gridSize);
        
        // Create two triangles for each quad
        if (x < CONFIG.gridSize - 1 && y < CONFIG.gridSize - 1) {
            const i0 = i;
            const i1 = i + 1;
            const i2 = i + CONFIG.gridSize;
            const i3 = i + CONFIG.gridSize + 1;
            
            // First triangle
            const geom1 = new THREE.BufferGeometry();
            const verts1 = new Float32Array([
                originalPositions[i0].x, originalPositions[i0].y, 0,
                originalPositions[i1].x, originalPositions[i1].y, 0,
                originalPositions[i2].x, originalPositions[i2].y, 0
            ]);
            geom1.setAttribute('position', new THREE.BufferAttribute(verts1, 3));
            const tri1 = new THREE.Mesh(geom1, triangleMaterial);
            meshGroup.add(tri1);
            
            // Second triangle
            const geom2 = new THREE.BufferGeometry();
            const verts2 = new Float32Array([
                originalPositions[i1].x, originalPositions[i1].y, 0,
                originalPositions[i3].x, originalPositions[i3].y, 0,
                originalPositions[i2].x, originalPositions[i2].y, 0
            ]);
            geom2.setAttribute('position', new THREE.BufferAttribute(verts2, 3));
            const tri2 = new THREE.Mesh(geom2, triangleMaterial);
            meshGroup.add(tri2);
        }
    }
}

function createConnectionLines() {
    // Store line objects for updating
    window.connectionLines = [];
    
    const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x00ffcc,
        transparent: true,
        opacity: 0.4
    });
    
    // Create lines between connected points
    for (let i = 0; i < triangles.length; i++) {
        const connections = triangles[i];
        
        for (const connectedIndex of connections) {
            if (connectedIndex > i) {
                const geometry = new THREE.BufferGeometry();
                const positions = new Float32Array(6);
                geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                
                const line = new THREE.Line(geometry, lineMaterial);
                meshGroup.add(line);
                connectionLines.push({
                    line: line,
                    indexA: i,
                    indexB: connectedIndex
                });
            }
        }
    }
}

function updateMesh(time) {
    const timeOffset = time * CONFIG.waveSpeed;
    
    // Update connection lines
    if (window.connectionLines) {
        for (const conn of window.connectionLines) {
            const pos = conn.line.geometry.attributes.position.array;
            const a = points[conn.indexA].position;
            const b = points[conn.indexB].position;
            pos[0] = a.x; pos[1] = a.y; pos[2] = a.z;
            pos[3] = b.x; pos[4] = b.y; pos[5] = b.z;
            conn.line.geometry.attributes.position.needsUpdate = true;
        }
    }
    
    for (let i = 0; i < points.length; i++) {
        const point = points[i];
        const pos = originalPositions[i];
        const vel = velocities[i];
        
        // Apply drag force if dragging
        if (isDragging) {
            const dx = point.position.x - mouseWorld.x;
            const dy = point.position.y - mouseWorld.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const radius = CONFIG.interactionRadius;
            
            if (distance < radius && distance > 0) {
                const force = (1 - distance / radius) * 0.5;
                vel.x -= (dx / distance) * force;
                vel.y -= (dy / distance) * force;
                vel.z += force * 0.3;
                
                // Color change on interaction
                point.material.color.setHSL(0.8 - distance / radius * 0.3, 1, 0.5);
            }
        }
        
        // Natural wave movement
        const waveX = Math.sin(timeOffset + point.position.x * 0.2) * CONFIG.waveHeight * 0.3;
        const waveY = Math.cos(timeOffset * 1.3 + point.position.y * 0.2) * CONFIG.waveHeight * 0.3;
        const waveZ = Math.sin(timeOffset * 0.7 + point.position.x * 0.1 + point.position.y * 0.1) * CONFIG.waveHeight;
        
        // Apply velocity with damping
        vel.multiplyScalar(CONFIG.damping);
        point.position.x += vel.x;
        point.position.y += vel.y;
        point.position.z += vel.z;
        
        // Return to original position with spring
        const springX = (pos.x - point.position.x) * CONFIG.springConstant;
        const springY = (pos.y - point.position.y) * CONFIG.springConstant;
        const springZ = (pos.z - point.position.z) * CONFIG.springConstant * 0.5;
        
        vel.x += springX;
        vel.y += springY;
        vel.z += springZ;
        
        // Add turbulence
        vel.x += (Math.random() - 0.5) * CONFIG.turbulence;
        vel.y += (Math.random() - 0.5) * CONFIG.turbulence;
        
        // Apply wave base position
        point.position.x = pos.x + waveX + vel.x * 10;
        point.position.y = pos.y + waveY + vel.y * 10;
        point.position.z = waveZ + vel.z * 10;
        
        // Return color after interaction
        if (!isDragging || Math.sqrt(
            (point.position.x - mouseWorld.x) ** 2 + 
            (point.position.y - mouseWorld.y) ** 2
        ) > CONFIG.interactionRadius) {
            point.material.color.lerp(new THREE.Color(0x00ffcc), 0.05);
        }
    }
}

function animate(time = 0) {
    requestAnimationFrame(animate);
    
    updateMesh(time * 0.001);
    
    // Gentle rotation
    meshGroup.rotation.z = Math.sin(time * 0.0002) * 0.05;
    
    renderer.render(scene, camera);
}

// Mouse handlers
function onMouseDown(event) {
    isDragging = true;
    dragStart.set(mouseWorld.x, mouseWorld.y, 0);
}

function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    mouseWorld.set(mouse.x * 50, mouse.y * 50, 0);
}

function onMouseUp() {
    isDragging = false;
}

// Touch handlers
function onTouchStart(event) {
    event.preventDefault();
    isDragging = true;
    
    const touch = event.touches[0];
    mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    mouseWorld.set(mouse.x * 50, mouse.y * 50, 0);
}

function onTouchMove(event) {
    event.preventDefault();
    
    const touch = event.touches[0];
    mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    mouseWorld.set(mouse.x * 50, mouse.y * 50, 0);
}

function onTouchEnd() {
    isDragging = false;
}

// Resize handler
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}