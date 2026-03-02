/* 
   ORBIAN AI — 3D SCENE CORE (Three.js)
   Renders a high-fidelity animated neural core
*/

(function () {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById('three-canvas'),
        alpha: true,
        antialias: true
    });

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Neural Core (Complex Sphere)
    const geometry = new THREE.IcosahedronGeometry(2, 4);
    const material = new THREE.MeshPhongMaterial({
        color: 0x8b5cf6,
        wireframe: true,
        transparent: true,
        opacity: 0.3,
        emissive: 0x6366f1,
        emissiveIntensity: 0.5
    });
    const core = new THREE.Mesh(geometry, material);
    scene.add(core);

    // Inner Glow Sphere
    const innerGeo = new THREE.SphereGeometry(1.5, 32, 32);
    const innerMat = new THREE.MeshBasicMaterial({
        color: 0x3b82f6,
        transparent: true,
        opacity: 0.1
    });
    const innerBall = new THREE.Mesh(innerGeo, innerMat);
    scene.add(innerBall);

    // Particles / Data Points
    const particlesCount = 1000;
    const positions = new Float32Array(particlesCount * 3);
    for (let i = 0; i < particlesCount * 3; i++) {
        positions[i] = (Math.random() - 0.5) * 15;
    }
    const particlesGeo = new THREE.BufferGeometry();
    particlesGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particlesMat = new THREE.PointsMaterial({
        size: 0.05,
        color: 0x8b5cf6,
        transparent: true,
        opacity: 0.5
    });
    const particles = new THREE.Points(particlesGeo, particlesMat);
    scene.add(particles);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0x8b5cf6, 2);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);

    camera.position.z = 8;

    // Movement Interaction
    let mouseX = 0, mouseY = 0;
    document.addEventListener('mousemove', (e) => {
        mouseX = (e.clientX / window.innerWidth - 0.5);
        mouseY = (e.clientY / window.innerHeight - 0.5);
    });

    function animate() {
        requestAnimationFrame(animate);

        core.rotation.y += 0.005;
        core.rotation.x += 0.002;

        // Dynamic floating
        core.position.y = Math.sin(Date.now() * 0.001) * 0.5;

        // Interaction
        particles.rotation.y += 0.001;
        scene.rotation.y += (mouseX * 0.5 - scene.rotation.y) * 0.05;
        scene.rotation.x += (mouseY * 0.5 - scene.rotation.x) * 0.05;

        renderer.render(scene, camera);
    }

    animate();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
})();
