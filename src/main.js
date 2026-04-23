// AL PRINCIPIO DE src/main.js

import './styles/main.scss';
import { db, storage } from './firebase.js'; 
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// ==========================================
// 🛡️ SEGURIDAD: EL PORTERO VIRTUAL (ACTUALIZADO PARA ASTRO)
// ==========================================
// Ahora busca '/admin' en lugar de 'admin.html'
if (window.location.pathname.includes('/admin')) {
    const session = localStorage.getItem('ge_session_token');
    if (session !== 'active') {
        window.location.href = '/login';
    }
}

// ==========================================
// 0. MENÚ MÓVIL
// ==========================================
const menuToggle = document.querySelector('.header__toggle');
const menuNav = document.querySelector('.header__nav');

if (menuToggle && menuNav) {
  menuToggle.addEventListener('click', () => {
    menuNav.classList.toggle('is-active');
    menuToggle.textContent = menuNav.classList.contains('is-active') ? '✕' : '☰';
  });
  document.querySelectorAll('.header__menu a').forEach(link => {
    link.addEventListener('click', () => {
      menuNav.classList.remove('is-active');
      menuToggle.textContent = '☰';
    });
  });
}

// =========================================================
// 1. GESTIÓN DE DATOS (CONECTADO A FIREBASE ☁️)
// =========================================================
let artistsData = []; 

async function loadArtistsFromCloud() {
    try {
      const querySnapshot = await getDocs(collection(db, "artists"));
      artistsData = []; 
      
      querySnapshot.forEach((doc) => {
          artistsData.push({ 
              id: doc.id, 
              ...doc.data() 
          });
      });
      
      artistsData.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

      window.globalArtistsData = artistsData;
  
      console.log("📡 Datos descargados de la nube:", artistsData.length);
      refreshAllViews(); 
      loadArtistProfile(); 
      initMiniCarousel();
      updateCounter(artistsData.length);
  
    } catch (error) {
      console.error("❌ Error al descargar datos:", error);
    }
}

function refreshAllViews() {
  populateCategories();
  const featuredArtists = artistsData.filter(a => a.isFeatured);
  
  //renderHomeArtists(featuredArtists); 
  renderHomeEditor(featuredArtists); 
  renderAdminList(artistsData);      
}

// ==========================================
// 2. LÓGICA HOME Y BUSCADOR
// ==========================================
const gridContainer = document.getElementById('artist-grid-container');
const searchInput = document.getElementById('search-name');
const searchCat = document.getElementById('search-category');
const searchBtn = document.querySelector('.search-bar__btn');
const suggestionsBox = document.getElementById('custom-suggestions');

function populateCategories() {
  const cats = [...new Set(artistsData.map(a => a.category))].filter(Boolean);
  const catOptions = cats.map(c => `<option value="${c}">${c}</option>`).join('');
  
  const zones = [...new Set(artistsData.map(a => a.zone))].filter(Boolean);
  const zoneOptions = zones.map(z => `<option value="${z}">${z}</option>`).join('');
  
  if (searchCat) searchCat.innerHTML = `<option value="">Todas las categorías</option>${catOptions}`;
  
  const searchZone = document.getElementById('search-zone');
  if (searchZone) searchZone.innerHTML = `<option value="">Todas las zonas</option>${zoneOptions}`;
  
  if (document.getElementById('cat-suggestions')) document.getElementById('cat-suggestions').innerHTML = catOptions;
  if (document.getElementById('admin-category-filter')) document.getElementById('admin-category-filter').innerHTML = `<option value="all">Todas las categorías</option>${catOptions}`;
}

function renderHomeArtists(list) {
  if (!gridContainer) return;
  if (list.length === 0) {
      gridContainer.innerHTML = '<p style="color:white; width:100%; text-align:center; padding: 50px;">Aún no hay artistas destacados en portada.</p>';
      return;
  }
  gridContainer.innerHTML = list.map(artist => `
    <article class="card">
      <div class="card__img-wrapper">
        <a href="/artist/${artist.id}" aria-label="Ver ficha de ${artist.name}" style="display:block; width:100%; height:100%;">
           <img src="${artist.images[0]}" alt="${artist.name}" class="card__image" loading="lazy">
        </a>
      </div>
      <div class="card__content">
        ${ artist.homeDescription 
           ? `<p style="color:#BF953F; font-size:0.9rem; margin-bottom:5px; font-style:italic;">"${artist.homeDescription}"</p>` 
           : `<span class="card__category">${artist.category}</span>` 
        }
        <h3 class="card__title">${artist.name}</h3>
        <p class="card__zone">📍 ${artist.zone}</p>
        <a href="/artist/${artist.id}" class="btn btn--gold" style="margin-top: 20px;">Ver Ficha</a>
      </div>
    </article>
  `).join('');
}

function executeSearch() {
    const nameVal = searchInput.value.toLowerCase().trim();
    const catVal = searchCat.value;
    const searchZone = document.getElementById('search-zone');
    const zoneVal = searchZone ? searchZone.value : ""; 

    // 1. REGLA DE ORO: Si no hay ningún filtro, restauramos la portada original
    if (nameVal === "" && catVal === "" && zoneVal === "") {
        // Cogemos solo los destacados, máximo 6
        const featuredArtists = artistsData.filter(a => a.isFeatured).slice(0, 6);
        paintGridCards(featuredArtists);
        return; // Paramos aquí la función
    }

    // 2. Si hay filtros, buscamos coincidencias
    const foundArtists = artistsData.filter(a => {
        const matchName = a.name.toLowerCase().includes(nameVal);
        const matchCat = (catVal === "" || a.category === catVal);
        const matchZone = (zoneVal === "" || a.zone === zoneVal); 
        return matchName && matchCat && matchZone;
    });

    // 3. Pintamos los resultados encontrados
    paintGridCards(foundArtists);
}

// Función de apoyo para pintar las tarjetas idénticas a las de Astro
// Función de apoyo para pintar las tarjetas idénticas a las de Astro
function paintGridCards(list) {
    if (!gridContainer) return;
    
    if (list.length > 0) {
        gridContainer.innerHTML = list.map(artist => {
            // Creamos el slug igual que en Astro
            const slug = artist.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
            
            return `
            <article class="card">
              <div class="card__img-wrapper">
                <a href="/artist/${slug}" style="display:block; width:100%; height:100%;">
                   <img src="${artist.images[0]}" alt="${artist.name}" class="card__image" loading="lazy">
                </a>
              </div>
              <div class="card__content">
                ${ artist.homeDescription 
                   ? `<p style="color:#BF953F; font-size:0.9rem; margin-bottom:5px; font-style:italic;">"${artist.homeDescription}"</p>` 
                   : `<span class="card__category">${artist.category}</span>` 
                }
                <h3 class="card__title">${artist.name}</h3>
                <p class="card__zone">📍 ${artist.zone}</p>
                
                <a href="/artist/${slug}" class="btn btn--gold" style="margin-top: 25px; align-self: flex-start; display: inline-block;">Ver Ficha</a>
              </div>
            </article>`;
        }).join('');
    } else {
        gridContainer.innerHTML = '<p style="color:#888; width:100%; text-align:center; padding: 40px;">No se encontraron artistas con esos filtros.</p>';
    }

    // 👇 EL ARREGLO DE LENIS: Le avisamos de que recalcule la altura
    setTimeout(() => {
        if (window.lenis) {
            window.lenis.resize();
        }
    }, 100); // Un pequeñísimo retraso asegura que las fotos ya ocupan espacio
}

// Exportamos para que index.astro pueda usarla
window.executeSearch = executeSearch;
// ==========================================
// 3. FICHA ARTISTA
// ==========================================
function loadArtistProfile() {
    const profileName = document.getElementById('profile-name');
    if (!profileName) return; 

    // Adaptado para Astro (coger ID de la URL si es necesario, aunque Astro ya inyecta los datos)
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const artist = artistsData.find(a => a.id == id);

    if (artist) {
        document.title = `${artist.name} | Global Events`;
        profileName.textContent = artist.name;
        document.getElementById('profile-category').textContent = artist.category;
        document.getElementById('profile-desc').innerText = artist.description || "Sin descripción.";
        document.getElementById('profile-zone').textContent = artist.zone;
        if(document.getElementById('sidebar-category')) document.getElementById('sidebar-category').textContent = artist.category;

        const links = document.getElementById('social-links-container');
        links.innerHTML = '';
        const s = artist.socials || {}; 

        if (s.instagram) links.innerHTML += `<a href="${s.instagram}" target="_blank" class="link-item"><i class="fa-brands fa-instagram"></i> Instagram</a>`;
        if (s.facebook) links.innerHTML += `<a href="${s.facebook}" target="_blank" class="link-item"><i class="fa-brands fa-facebook"></i> Facebook</a>`;
        if (s.website) links.innerHTML += `<a href="${s.website}" target="_blank" class="link-item"><i class="fa-solid fa-globe"></i> Web</a>`;

        const mainVideo = artist.videoUrl || s.youtube;
        const videosDelArtista = [mainVideo, artist.videoUrl2, artist.videoUrl3].filter(Boolean);

        const videoSection = document.getElementById('artist-video-section');
        const iframe = document.getElementById('main-video-player');
        const buttonsContainer = document.getElementById('video-playlist-buttons');

        if (videoSection && iframe && buttonsContainer) {
            if (videosDelArtista.length > 0) {
                videoSection.style.display = 'block'; 
                buttonsContainer.innerHTML = ''; 

                const getYouTubeEmbedUrl = (url) => {
                    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
                    const match = url.match(regExp);
                    return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : null;
                };

                let isFirstValidVideoSet = false;

                videosDelArtista.forEach((videoUrl, index) => {
                    const embedUrl = getYouTubeEmbedUrl(videoUrl);
                    if (!embedUrl) return; 

                    if (!isFirstValidVideoSet) {
                        iframe.src = embedUrl;
                        isFirstValidVideoSet = true;
                    }

                    const btn = document.createElement('button');
                    btn.innerHTML = `<i class="fa-solid fa-play"></i> Vídeo ${index + 1}`;
                    if (index === 0) btn.classList.add('active'); 

                    btn.addEventListener('click', () => {
                        iframe.src = embedUrl; 
                        document.querySelectorAll('#video-playlist-buttons button').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                    });

                    buttonsContainer.appendChild(btn);
                });
            } else {
                videoSection.style.display = 'none';
            }
        }
        
        const track = document.getElementById('slider-track');
        if (track) {
            track.innerHTML = '';
            if(artist.images && artist.images.length > 0) {
                artist.images.forEach((imgUrl, index) => {
                    const slide = document.createElement('div');
                    slide.className = `slide ${index === 0 ? 'is-active' : ''}`;
                    slide.innerHTML = `<img src="${imgUrl}" alt="${artist.name}">`;
                    track.appendChild(slide);
                });
            }
            initProfileSlider();
        }
    }
}

function initProfileSlider() {
    const slides = document.querySelectorAll('.artist-gallery .slide');
    const prevBtn = document.getElementById('btn-prev');
    const nextBtn = document.getElementById('btn-next');
    if (slides.length <= 1) { 
        if(prevBtn) prevBtn.style.display = 'none'; 
        if(nextBtn) nextBtn.style.display = 'none'; 
        return; 
    } else {
        if(prevBtn) prevBtn.style.display = 'block'; 
        if(nextBtn) nextBtn.style.display = 'block'; 
    }
    let currentSlide = 0;
    const showSlide = (n) => {
        slides.forEach(s => s.classList.remove('is-active'));
        currentSlide = (n + slides.length) % slides.length;
        slides[currentSlide].classList.add('is-active');
    };
    if(prevBtn) prevBtn.addEventListener('click', () => showSlide(currentSlide - 1));
    if(nextBtn) nextBtn.addEventListener('click', () => showSlide(currentSlide + 1));
}


// ==========================================
// 4. ADMIN: GESTIÓN DE ESTRELLAS Y LISTAS
// ==========================================
window.toggleFeatured = async (id) => {
    const artist = artistsData.find(a => a.id === id);
    if (!artist) return;

    const currentFeaturedCount = artistsData.filter(a => a.isFeatured).length;
    if (!artist.isFeatured && currentFeaturedCount >= 6) {
        alert("⚠️ ¡Límite alcanzado! Solo puedes tener 6 en portada.");
        return;
    }

    try {
        const newStatus = !artist.isFeatured;
        const artistRef = doc(db, "artists", id);
        await updateDoc(artistRef, { isFeatured: newStatus });
        loadArtistsFromCloud(); 
    } catch (error) {
        console.error("Error al actualizar estrella:", error);
        alert("No se pudo cambiar el estado destacado.");
    }
};

function renderAdminList(list) {
    const container = document.getElementById('admin-artist-list');
    if (!container) return;
    
    container.innerHTML = list.map((artist) => {
      const starClass = artist.isFeatured ? "fa-solid fa-star" : "fa-regular fa-star";
      const starColor = artist.isFeatured ? "color: gold;" : "color: gray;";
      const featuredLabel = artist.isFeatured ? '<span style="color:#FFD700; font-size:0.7rem; display:block;">★ EN PORTADA</span>' : '';

      return `
      <article class="admin-card">
        <img src="${artist.images[0]}" class="admin-card__thumb">
        <div class="admin-card__info">
            <h3>${artist.name}</h3>
            ${featuredLabel}
            <p>${artist.category}</p>
        </div>
        <div class="admin-card__actions">
          <button onclick="window.toggleFeatured('${artist.id}')" style="background:none; border:none; font-size:1.2rem; cursor:pointer; margin-right:10px;">
            <i class="${starClass}" style="${starColor}"></i>
          </button>
          <button onclick="window.openEditModal('${artist.id}')"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-delete" onclick="window.deleteArtist('${artist.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </article>
    `}).join('');
}


// ==========================================
// 5. EDITOR DE PORTADA CON DRAG & DROP
// ==========================================
function renderHomeEditor(list) {
    const container = document.getElementById('home-artist-list');
    if (!container) return;
    
    if(list.length === 0) {
        container.innerHTML = "<p style='color:#666; width:100%; text-align:center;'>No hay artistas seleccionados</p>";
        return;
    }

    container.innerHTML = list.map((artist, index) => `
      <div class="home-edit-card" data-id="${artist.id}">
         <div class="pos-badge">POS ${index + 1}</div>
         <img src="${artist.images[0]}">
         <div class="info">
            <h4>${artist.name}</h4>
            <span style="font-size:0.8rem; color:#aaa;">"${artist.homeDescription || 'Sin frase'}"</span>
         </div>
         <button class="btn-edit-mini" onclick="window.openHomeEditModal('${artist.id}')">
            <i class="fa-solid fa-image"></i> EDITAR PORTADA
         </button>
      </div>
    `).join('');

    initSortable();
}

function initSortable() {
    const el = document.getElementById('home-artist-list');
    if (!el || typeof Sortable === 'undefined') return;

    if (el._sortable) el._sortable.destroy();

    el._sortable = new Sortable(el, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        delay: 0, 
        delayOnTouchOnly: true, 
        
        onEnd: async function (evt) {
            const itemEls = el.querySelectorAll('.home-edit-card');
            const newOrderIds = Array.from(itemEls).map(item => item.getAttribute('data-id'));

            itemEls.forEach((item, index) => {
                const badge = item.querySelector('.pos-badge');
                if(badge) badge.textContent = `POS ${index + 1}`;
            });

            try {
                const updates = newOrderIds.map((id, index) => {
                    const docRef = doc(db, "artists", id);
                    return updateDoc(docRef, { order: index }); 
                });

                await Promise.all(updates);
                
                newOrderIds.forEach((id, index) => {
                    const a = artistsData.find(x => x.id === id);
                    if(a) a.order = index;
                });
                artistsData.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

            } catch (error) {
                console.error("Error al guardar orden:", error);
            }
        }
    });
}


// ==========================================
// 6. MODAL PORTADA
// ==========================================
const homeModal = document.getElementById('home-edit-modal');
const homeForm = document.getElementById('home-edit-form');
let tempSelectedCoverIndex = 0;

window.openHomeEditModal = (id) => {
    const artist = artistsData.find(a => a.id === id);
    if (!artist) return;

    document.getElementById('home-edit-id').value = artist.id;
    document.getElementById('home-artist-name').textContent = artist.name;
    document.getElementById('home-artist-cat').textContent = artist.category;
    document.getElementById('home-edit-desc').value = artist.homeDescription || "";

    tempSelectedCoverIndex = 0; 
    renderCoverSelector(artist.images);
    if(homeModal) homeModal.classList.add('is-visible');
};

function renderCoverSelector(images) {
    const container = document.getElementById('cover-selector-container');
    if(!container) return;
    container.innerHTML = images.map((img, index) => {
        const isSelected = (index === tempSelectedCoverIndex) ? 'is-selected' : '';
        return `
            <div class="cover-option ${isSelected}" onclick="window.selectCoverImage(${index})">
                <img src="${img}">
            </div>
        `;
    }).join('');
}

window.selectCoverImage = (index) => {
    tempSelectedCoverIndex = index;
    const artistId = document.getElementById('home-edit-id').value;
    const artist = artistsData.find(a => a.id == artistId);
    renderCoverSelector(artist.images);
};

if (homeForm) {
    homeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const id = document.getElementById('home-edit-id').value;
        const newDesc = document.getElementById('home-edit-desc').value;
        const btnSubmit = homeForm.querySelector('button[type="submit"]');

        const idx = artistsData.findIndex(a => a.id == id);
        if (idx === -1) return;

        let artist = artistsData[idx];
        let updatedImages = [...artist.images];

        if (tempSelectedCoverIndex > 0) {
            const selectedImage = updatedImages[tempSelectedCoverIndex];
            updatedImages.splice(tempSelectedCoverIndex, 1); 
            updatedImages.unshift(selectedImage); 
        }

        btnSubmit.textContent = "Guardando...";
        btnSubmit.disabled = true;

        try {
            const artistRef = doc(db, "artists", id);
            await updateDoc(artistRef, {
                homeDescription: newDesc, 
                images: updatedImages     
            });
            loadArtistsFromCloud(); 
            if(homeModal) homeModal.classList.remove('is-visible');

            window.location.reload();

        } catch (error) {
            console.error("Error al actualizar portada:", error);
            alert("Error: " + error.message);
        } finally {
            btnSubmit.textContent = "Guardar Portada";
            btnSubmit.disabled = false;
        }
    });
}

// ==========================================
// 7. EDICIÓN FICHA COMPLETA
// ==========================================
const modal = document.getElementById('artist-modal');
const form = document.getElementById('artist-form');
let currentGallery = [];

const btnToggleHome = document.getElementById('btn-toggle-home-editor');
const homePanel = document.getElementById('home-editor-panel');
if (btnToggleHome) {
    btnToggleHome.addEventListener('click', () => {
        if(homePanel) homePanel.classList.toggle('hidden');
    });
}

window.removeImageFromGallery = (idx) => { currentGallery.splice(idx,1); renderGalleryPreview(); };
const multiFile = document.getElementById('multi-file-input');
if(multiFile) multiFile.addEventListener('change', function(){
    Array.from(this.files).forEach(f => {
        const r = new FileReader();
        r.onload = e => { currentGallery.push(e.target.result); renderGalleryPreview(); };
        r.readAsDataURL(f);
    });
});

function renderGalleryPreview() {
    const box = document.getElementById('gallery-preview-container');
    if(!box) return;
    box.innerHTML = currentGallery.map((src,i) => 
        `<div class="gallery-item" style="cursor: grab;"><img src="${src}"><button type="button" class="btn-remove-img" onclick="window.removeImageFromGallery(${i})">✕</button></div>`
    ).join('');

    if (typeof Sortable !== 'undefined') {
        if (box._sortable) box._sortable.destroy(); 
        
        box._sortable = new Sortable(box, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: function (evt) {
                if (evt.oldIndex === evt.newIndex) return; 
                const movedItem = currentGallery.splice(evt.oldIndex, 1)[0];
                currentGallery.splice(evt.newIndex, 0, movedItem);
                renderGalleryPreview();
            }
        });
    }
}

window.openEditModal = (id) => {
    const artist = artistsData.find(a => a.id === id);
    if (!artist) return;
    
    document.getElementById('modal-title').textContent = "Modificar Ficha";
    document.getElementById('artist-id').value = artist.id;
    document.getElementById('artist-name').value = artist.name;
    document.getElementById('artist-category').value = artist.category;
    document.getElementById('artist-zone').value = artist.zone;
    document.getElementById('description').value = artist.description || "";
    
    const s = artist.socials || {};
    document.getElementById('social-instagram').value = s.instagram || "";
    document.getElementById('social-facebook').value = s.facebook || "";
    document.getElementById('social-website').value = s.website || "";
    document.getElementById('social-youtube').value = artist.videoUrl || s.youtube || "";
    if(document.getElementById('video2')) document.getElementById('video2').value = artist.videoUrl2 || "";
    if(document.getElementById('video3')) document.getElementById('video3').value = artist.videoUrl3 || "";

    currentGallery = [...artist.images];
    renderGalleryPreview();
    if(modal) modal.classList.add('is-visible');
};

const btnAdd = document.getElementById('add-artist-btn');
if (btnAdd) {
    btnAdd.addEventListener('click', () => {
        if(form) form.reset();
        document.getElementById('artist-id').value = ""; 
        currentGallery = [];
        renderGalleryPreview();
        document.getElementById('modal-title').textContent = "Añadir Nuevo Artista";
        if(modal) modal.classList.add('is-visible');
    });
}

if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnSubmit = form.querySelector('button[type="submit"]');
        const originalText = btnSubmit.textContent;
        btnSubmit.textContent = "Subiendo fotos a la nube... (Espera)";
        btnSubmit.disabled = true;

        try {
            let finalImageUrls = [];
            if (currentGallery.length === 0) {
                finalImageUrls.push("https://via.placeholder.com/400?text=Sin+Foto");
            } else {
                for (const imgData of currentGallery) {
                    if (imgData.startsWith('http')) {
                        finalImageUrls.push(imgData); 
                    } else {
                        const blob = await (await fetch(imgData)).blob();
                        const filename = `artists/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
                        const storageRef = ref(storage, filename);
                        const snapshot = await uploadBytes(storageRef, blob);
                        const downloadUrl = await getDownloadURL(snapshot.ref);
                        finalImageUrls.push(downloadUrl);
                    }
                }
            }

            const id = document.getElementById('artist-id').value;
            const toTitleCase = (str) => {
                return str.replace(/\w\S*/g, (txt) => {
                    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
                });
            };

            const artistData = {
                name: toTitleCase(document.getElementById('artist-name').value),
                category: toTitleCase(document.getElementById('artist-category').value),
                zone: toTitleCase(document.getElementById('artist-zone').value),
                description: document.getElementById('description').value,
                images: finalImageUrls, 
                videoUrl: document.getElementById('social-youtube').value, 
                videoUrl2: document.getElementById('video2') ? document.getElementById('video2').value : "",
                videoUrl3: document.getElementById('video3') ? document.getElementById('video3').value : "",
                isFeatured: false, 
                homeDescription: "",
                socials: {
                    instagram: document.getElementById('social-instagram').value,
                    facebook: document.getElementById('social-facebook').value,
                    website: document.getElementById('social-website').value,
                }
            };

            // ... dentro del submit del form ...
if (id) {
    const docRef = doc(db, "artists", id);
    const updateData = { ...artistData };
    
    // IMPORTANTE: Usamos == en lugar de === para evitar fallos de ID
    const oldArtist = artistsData.find(a => a.id == id);
    if(oldArtist) {
        updateData.isFeatured = oldArtist.isFeatured;
        updateData.homeDescription = oldArtist.homeDescription || "";
        updateData.order = oldArtist.order ?? 999;
    }

    await updateDoc(docRef, updateData);
    alert("¡Ficha modificada correctamente!");
} else {
    await addDoc(collection(db, "artists"), artistData);
    alert("¡Artista guardado en la nube!");
}

// 🔄 LA CLAVE: Refrescamos la web entera para limpiar la memoria
window.location.reload();

        } catch (error) {
            console.error("❌ Error grave al guardar:", error);
            alert("Hubo un error al subir los datos: " + error.message);
        } finally {
            btnSubmit.textContent = originalText;
            btnSubmit.disabled = false;
        }
    });
}

document.querySelectorAll('.modal__close, #cancel-modal, #cancel-home-modal').forEach(btn => 
    btn.addEventListener('click', () => {
        if(modal) modal.classList.remove('is-visible');
        if(homeModal) homeModal.classList.remove('is-visible');
    })
);

window.deleteArtist = async (id) => {
    if (!confirm('¿Seguro que quieres borrar este artista de la nube?')) return;
    try {
        await deleteDoc(doc(db, "artists", id));
        alert("¡Artista eliminado correctamente!");
        window.location.reload(); // 👇 AÑADE ESTO AQUÍ TAMBIÉN 👇
    } catch (error) {
        alert("No se pudo borrar: " + error.message);
    }
};

if (document.getElementById('admin-search')) {
    document.getElementById('admin-search').addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase();
        const filtered = artistsData.filter(a => a.name.toLowerCase().includes(val));
        renderAdminList(filtered);
    });
}

// ==========================================
// 8. LOGIN Y LOGOUT
// ==========================================
if (document.getElementById('login-form')) {
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const pass = document.getElementById('password').value;

        // Credenciales adaptadas a la nueva ruta /admin
        if (email === 'admin@rdglobalevents.com' && pass === '9520dvwDVW') {
            localStorage.setItem('ge_session_token', 'active');
            window.location.href = '/admin';
        } else { 
            alert('Incorrecto'); 
        }
    });
}

window.logout = () => { 
    if(confirm('¿Salir?')) {
        localStorage.removeItem('ge_session_token');
        window.location.href = '/login';
    } 
};

// ==========================================
// 10. LENIS SCROLL 
// ==========================================
if (typeof Lenis !== 'undefined') {
    const lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), 
        direction: 'vertical', 
        gestureDirection: 'vertical',
        smooth: true,
        mouseMultiplier: 1,  
        smoothTouch: false,  
        touchMultiplier: 2,
    });

    window.lenis = lenis;

    function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
    
    // 👇 EL VIGILANTE: ESTA ES LA MAGIA QUE ARREGLA EL ATASCO 👇
    const resizeObserver = new ResizeObserver(() => {
        lenis.resize();
    });
    // Le decimos que vigile todo el cuerpo de la página constantemente
    resizeObserver.observe(document.body);
    // 👆 FIN DEL VIGILANTE 👆

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            lenis.scrollTo(this.getAttribute('href'));
        });
    });
}
// ==========================================
// 11. CARRUSEL INFINITO
// ==========================================
function initMiniCarousel() {
    const track = document.getElementById('mini-carousel-track');
    const section = document.querySelector('.other-talents-section');
    if (!track) return;

    let baseList = artistsData.filter(a => !a.isFeatured);

    if (baseList.length === 0) {
        if (section) section.style.display = 'none';
        return;
    }

    let finalDisplayList = [];
    const minItemsNeeded = 12; 

    const getShuffledBatch = () => {
        return [...baseList].sort(() => Math.random() - 0.5);
    };

    finalDisplayList = getShuffledBatch();

    while (finalDisplayList.length < minItemsNeeded) {
        let nextBatch = getShuffledBatch();
        if (finalDisplayList.length > 0 && nextBatch.length > 1) {
            const lastArtist = finalDisplayList[finalDisplayList.length - 1];
            const firstNextArtist = nextBatch[0];
            if (lastArtist.id === firstNextArtist.id) {
                nextBatch.push(nextBatch.shift());
            }
        }
        finalDisplayList = [...finalDisplayList, ...nextBatch];
    }

    const singleSetCount = finalDisplayList.length;

    // 1. Añadimos el creador de enlaces limpios (slugs)
    const createSlug = (text) => {
        if (!text) return '';
        return text.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
    };

    // 2. Rutas dinámicas para el carrusel generadas con el SLUG
    const cardsHTML = finalDisplayList.map(artist => {
        const slug = createSlug(artist.name); // Convertimos "Mago Pop" en "mago-pop"
        return `
        <a href="/artist/${slug}" class="mini-card" style="text-decoration:none;">
            <div class="mini-card__img-wrapper">
                <img src="${artist.images[0]}" alt="${artist.name}" class="mini-card__img" loading="lazy">
            </div>
            <div class="mini-card__info">
                <span class="mini-card__cat">${artist.category}</span>
                <h4 class="mini-card__name">${artist.name}</h4>
                <div class="mini-card__zone"><i class="fa-solid fa-location-dot"></i> ${artist.zone}</div>
            </div>
        </a>
    `}).join('');

    track.innerHTML = cardsHTML.repeat(6);
    track.style.display = 'flex';
    track.style.width = 'max-content'; 

    const wrapper = document.querySelector('.mini-carousel-wrapper');
    if (window.carouselFrame) cancelAnimationFrame(window.carouselFrame);

    let scrollPos = 0;
    const normalSpeed = 0.8; 
    const fastSpeed = 6.0;   
    let currentSpeed = normalSpeed;

    const btnPrev = document.getElementById('mini-prev');
    const btnNext = document.getElementById('mini-next');
    const goFastFwd = () => currentSpeed = fastSpeed;
    const goFastBack = () => currentSpeed = -fastSpeed; 
    const resetSpeed = () => currentSpeed = normalSpeed;

    if(btnNext) {
        btnNext.addEventListener('mousedown', goFastFwd);
        btnNext.addEventListener('mouseup', resetSpeed);
        btnNext.addEventListener('mouseleave', resetSpeed);
        btnNext.addEventListener('touchstart', (e) => { e.preventDefault(); goFastFwd(); });
        btnNext.addEventListener('touchend', resetSpeed);
    }

    if(btnPrev) {
        btnPrev.addEventListener('mousedown', goFastBack);
        btnPrev.addEventListener('mouseup', resetSpeed);
        btnPrev.addEventListener('mouseleave', resetSpeed);
        btnPrev.addEventListener('touchstart', (e) => { e.preventDefault(); goFastBack(); });
        btnPrev.addEventListener('touchend', resetSpeed);
    }

    function animateCarousel() {
        scrollPos += currentSpeed;
        
        if (track.firstElementChild) {
            const cardWidth = track.firstElementChild.getBoundingClientRect().width;
            const style = window.getComputedStyle(track);
            const gap = parseFloat(style.gap) || 0; 
            const singleSetWidth = (cardWidth + gap) * singleSetCount;

            if (singleSetWidth > 0) {
                if (scrollPos >= singleSetWidth) {
                    scrollPos -= singleSetWidth;
                }
                if (scrollPos <= 0) {
                    scrollPos += singleSetWidth;
                }
            }
        }
        
        if(wrapper) wrapper.scrollLeft = scrollPos;
        window.carouselFrame = requestAnimationFrame(animateCarousel);
    }

    window.carouselFrame = requestAnimationFrame(animateCarousel);
}

// ==========================================
// 12. CONTADOR MECÁNICO
// ==========================================
function updateCounter(total) {
    const counterContainer = document.getElementById('total-artists-counter');
    if (!counterContainer) return;

    const finalNumber = total;
    const duration = 1500; 
    let startTimestamp = null;

    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const currentNum = Math.floor(progress * finalNumber);
        const displayNum = currentNum.toString().padStart(3, '0');
        
        counterContainer.innerHTML = displayNum.split('').map(n => 
            `<span class="digit">${n}</span>`
        ).join('');

        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
             counterContainer.innerHTML = finalNumber.toString().padStart(3, '0').split('').map(n => 
                `<span class="digit">${n}</span>`
            ).join('');
        }
    };
    window.requestAnimationFrame(step);
}

// ==========================================
// 🍪 LÓGICA DEL BANNER DE COOKIES
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const cookieBanner = document.getElementById('cookie-banner');
    const btnAccept = document.getElementById('btn-accept-cookies');
    const btnReject = document.getElementById('btn-reject-cookies');

    if (cookieBanner) {
        const cookieStatus = localStorage.getItem('rd_cookies_status');

        if (!cookieStatus) {
            setTimeout(() => {
                cookieBanner.classList.remove('hidden');
            }, 500);
        }

        btnAccept.addEventListener('click', () => {
            localStorage.setItem('rd_cookies_status', 'accepted');
            cookieBanner.classList.add('hidden');
        });

        btnReject.addEventListener('click', () => {
            localStorage.setItem('rd_cookies_status', 'rejected');
            cookieBanner.classList.add('hidden');
        });
    }
});

// INICIO
loadArtistProfile();
loadArtistsFromCloud(); 
console.log('App Ready: ASTRO CLOUD VERSION 🚀');