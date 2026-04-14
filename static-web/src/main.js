import './style.css'

const API_BASE = 'http://localhost:5000/api'
const videoGrid = document.getElementById('video-grid')
const searchInput = document.getElementById('search-input')
const modal = document.getElementById('player-modal')
const closeModal = document.querySelector('.close')
const videoContainer = document.getElementById('video-container')
const modalTitle = document.getElementById('modal-title')
const modalDesc = document.getElementById('modal-desc')

async function fetchTrending() {
  try {
    const res = await fetch(`${API_BASE}/trending?page=0&perPage=24`)
    const data = await res.json()
    if (data.status === 'success') {
      renderVideos(data.data.items || data.data.subjectList)
    }
  } catch (err) {
    videoGrid.innerHTML = `<p class="loading">Error loading videos. Make sure backend is running.</p>`
  }
}

function renderVideos(videos) {
  videoGrid.innerHTML = ''
  videos.forEach(video => {
    const card = document.createElement('div')
    card.className = 'video-card'
    const thumb = video.thumbnail || (video.cover && video.cover.url) || '/placeholder.jpg'
    
    card.innerHTML = `
      <img src="${thumb}" alt="${video.title}" />
      <h3>${video.title}</h3>
      <p>${video.year || ''} • ${video.quality || 'HD'}</p>
    `
    card.onclick = () => openPlayer(video)
    videoGrid.appendChild(card)
  })
}

async function openPlayer(video) {
  modal.style.display = 'block'
  modalTitle.innerText = video.title
  modalDesc.innerText = video.description || video.synopsis || ''
  videoContainer.innerHTML = '<p class="loading">Loading sources...</p>'

  try {
    const res = await fetch(`${API_BASE}/sources/${video.subjectId || video.id}`)
    const data = await res.json()
    if (data.status === 'success' && data.data.processedSources.length > 0) {
      const source = data.data.processedSources[0]
      videoContainer.innerHTML = `
        <video controls autoplay>
          <source src="${source.streamUrl}" type="video/mp4">
          Your browser does not support the video tag.
        </video>
      `
    } else {
      videoContainer.innerHTML = '<p class="loading">No playable sources found.</p>'
    }
  } catch (err) {
    videoContainer.innerHTML = '<p class="loading">Error loading sources.</p>'
  }
}

closeModal.onclick = () => {
  modal.style.display = 'none'
  videoContainer.innerHTML = ''
}

window.onclick = (event) => {
  if (event.target == modal) {
    modal.style.display = 'none'
    videoContainer.innerHTML = ''
  }
}

searchInput.onkeypress = async (e) => {
  if (e.key === 'Enter') {
    const query = searchInput.value
    if (!query) return fetchTrending()
    
    videoGrid.innerHTML = '<p class="loading">Searching...</p>'
    try {
      const res = await fetch(`${API_BASE}/search/${query}`)
      const data = await res.json()
      if (data.status === 'success') {
        renderVideos(data.data.items)
      }
    } catch (err) {
      videoGrid.innerHTML = '<p class="loading">Search failed.</p>'
    }
  }
}

fetchTrending()
