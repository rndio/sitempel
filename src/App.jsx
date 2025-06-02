import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, LayersControl, LayerGroup, ZoomControl } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'
import L from 'leaflet'

// Fix icon issues for Leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
})

// Custom user location icon
const userIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Custom bengkel icon
const bengkelIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Custom selected bengkel icon
const selectedBengkelIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [30, 45], // Slightly larger to emphasize selection
  iconAnchor: [15, 45],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function App() {
  const [geojson, setGeojson] = useState(null)
  const [showBengkel, setShowBengkel] = useState(true)
  const [userLocation, setUserLocation] = useState(null)
  const [nearest, setNearest] = useState(null)
  const [nearestBengkels, setNearestBengkels] = useState([]);
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('Memuat data bengkel...')
  const [fetchError, setFetchError] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mapCenter, setMapCenter] = useState([-6.2, 106.8])
  const [bengkelCount, setBengkelCount] = useState(0)
  const mapRef = useRef();
  const markerRefs = useRef([]);

  const toggleSidebar = () => {
    setSidebarOpen(prev => {
      const next = !prev;
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      }, 350); // Sesuaikan dengan durasi animasi sidebar (ms)
      return next;
    });
  };

  // Lebar sidebar (px) untuk desktop
  const SIDEBAR_WIDTH = 384; // md:w-96

  // Panggil invalidateSize saat sidebarOpen berubah
  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => {
        mapRef.current.invalidateSize();
      }, 300); // delay agar animasi selesai
    }
  }, [sidebarOpen]);

  // Fetch GeoJSON automatically on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        setLoadingMessage('Memuat data bengkel...')
        setFetchError(null)
        
        const response = await fetch('/bengkel.geojson')
        
        if (!response.ok) {
          throw new Error(`Network error: ${response.status} ${response.statusText}`)
        }
        
        const data = await response.json()
        setGeojson(data)
        setBengkelCount(data.features.length)
        setIsLoading(false)

        // Fly to the first bengkel's coordinate after fetch
        if (data.features && data.features.length > 0) {
          const [lng, lat] = data.features[0].geometry.coordinates;
          setMapCenter([lat, lng]);
          // FlyTo jika map sudah siap
          setTimeout(() => {
            if (mapRef.current) {
              mapRef.current.flyTo([lat, lng], 15, { duration: 1.2 });
            }
          }, 400);
        }

        // Automatically get user location after successful data fetch
        if ('geolocation' in navigator) {
          getLocation()
        }
      } catch (err) {
        console.error("Failed to load GeoJSON:", err)
        setFetchError(`Gagal memuat data bengkel: ${err.message}`)
        setIsLoading(false)
      }
    }
    
    fetchData()
  }, [])

  // Get user location
  const getLocation = () => {
    setIsLoading(true)
    setLoadingMessage('Mendapatkan lokasi Anda...')
    setFetchError(null)
    
    navigator.geolocation.getCurrentPosition(
      pos => {
        const userPos = [pos.coords.latitude, pos.coords.longitude]
        setUserLocation(userPos)
        setMapCenter(userPos)
        setIsLoading(false)
        
        // Optional: automatically find nearest after getting location
        if (geojson) {
          findNearest(userPos)
        }
      },
      err => {
        console.error("Error getting location:", err)
        setFetchError(`Tidak dapat mengakses lokasi Anda: ${err.message}`)
        setIsLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 } // Better location options
    )
  }

  // Modifikasi fungsi findNearest untuk mengambil lokasi jika belum tersedia
  const findNearest = async (location = null) => {
    setIsLoading(true);
    
    // Jika tidak ada lokasi, dapatkan lokasi terlebih dahulu
    if (!location) {
      setLoadingMessage('Mendapatkan lokasi Anda...');
      
      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            pos => resolve(pos),
            err => reject(err),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        });
        
        location = [position.coords.latitude, position.coords.longitude];
        setUserLocation(location);
        setMapCenter(location);
      } catch (err) {
        console.error("Error getting location:", err);
        setFetchError(`Tidak dapat mengakses lokasi Anda: ${err.message}`);
        setIsLoading(false);
        return;
      }
    }
    
    // Pastikan geojson telah dimuat
    if (!geojson) {
      setFetchError('Data bengkel belum dimuat. Silakan muat ulang halaman.');
      setIsLoading(false);
      return;
    }
    
    setLoadingMessage('Mencari bengkel terdekat...');
    
    // Calculate distances for all bengkels
    const bengkelsWithDistance = geojson.features.map(f => {
      const [lng, lat] = f.geometry.coordinates;
      
      // Haversine formula for more accurate distance calculation
      const R = 6371; // Radius of the earth in km
      const dLat = (lat - location[0]) * Math.PI / 180;
      const dLon = (lng - location[1]) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(location[0] * Math.PI / 180) * Math.cos(lat * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c; // Distance in km
      
      return {...f, distance};
    });
    
    // Sort by distance and get the top 3
    const sortedBengkels = [...bengkelsWithDistance].sort((a, b) => a.distance - b.distance);
    const nearest3 = sortedBengkels.slice(0, 3);
    
    // Set state for nearest bengkel and the list of 3 nearest
    setNearest(nearest3[0]);
    setNearestBengkels(nearest3);
    
    setIsLoading(false);
    
    // Center map to include user and nearest bengkel
    if (nearest3.length > 0) {
      const [lng, lat] = nearest3[0].geometry.coordinates;
      setMapCenter([(location[0] + lat)/2, (location[1] + lng)/2]);
    }
  };

  // Fungsi untuk flyTo dan buka popup
  const flyToBengkel = (bengkel, index) => {
    if (mapRef.current && markerRefs.current[index]) {
      const [lng, lat] = bengkel.geometry.coordinates;
      mapRef.current.flyTo([lat, lng], 17, { duration: 1.2 });
      setTimeout(() => {
        markerRefs.current[index].openPopup();
      }, 700); // delay agar map sudah sampai
    }
    setNearest(bengkel);
  };

  // Format distance to readable text
  const formatDistance = (distance) => {
    if (distance < 1) {
      return `${(distance * 1000).toFixed(0)} meter`
    } else {
      return `${distance.toFixed(2)} km`
    }
  }

  return (
    <div className="flex flex-row min-h-screen w-full h-full relative overflow-hidden">
      {/* Sidebar */}
      <div
        className={`
          transition-all duration-300 ease-in-out bg-white shadow-lg z-10
          ${sidebarOpen ? 'w-full md:w-96' : 'w-0'}
          h-screen overflow-y-auto
        `}
        style={{
          minWidth: sidebarOpen ? SIDEBAR_WIDTH : 0,
          maxWidth: sidebarOpen ? SIDEBAR_WIDTH : 0,
          padding: sidebarOpen ? 20 : 0,
        }}
      >
        {sidebarOpen && (
          <div>
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-gray-800">Peta SiTempel</h1>
              <p className="text-sm text-gray-500 mt-1">Temukan tambal ban terdekat dari lokasi Anda</p>
              {bengkelCount > 0 && (
                <div className="mt-2 inline-block px-3 py-1 bg-blue-50 rounded-full text-xs font-medium text-blue-700">
                  {bengkelCount} tambal ban tersedia
                </div>
              )}
            </div>
            
            {fetchError && (
              <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{fetchError}</p>
                    <button 
                      className="mt-2 text-xs text-red-600 hover:underline font-medium"
                      onClick={() => window.location.reload()}
                    >
                      Muat Ulang Halaman
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            <div className="mb-6 bg-white rounded-lg shadow-sm p-4 border border-gray-100">
              <h2 className="font-bold text-lg mb-3 text-gray-700">Kontrol Layer</h2>
              <div className="bg-gray-50 p-3 rounded-lg">
                <label className="flex items-center cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={showBengkel}
                      onChange={() => setShowBengkel(!showBengkel)}
                    />
                    <div className={`block w-14 h-8 rounded-full ${showBengkel ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition shadow-md ${showBengkel ? 'transform translate-x-6' : ''}`}></div>
                  </div>
                  <span className="ml-3 text-gray-700">Tampilkan Tambal Ban</span>
                </label>
              </div>
            </div>
            
            <div className="mb-6 bg-white rounded-lg shadow-sm p-4 border border-gray-100">
              <h2 className="font-bold text-lg mb-3 text-gray-700">Lokasi</h2>
              <div>
                <button
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center shadow-sm"
                  onClick={() => findNearest()}
                  disabled={isLoading}
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Cari Tambal Ban Terdekat
                </button>
                {userLocation && (
                  <div className="mt-3 text-center text-xs text-gray-500">
                    Lokasi ditemukan: {userLocation[0].toFixed(6)}, {userLocation[1].toFixed(6)}
                  </div>
                )}
              </div>
            </div>
            
            {nearestBengkels.length > 0 && (
              <div className="mb-6">
                <h2 className="font-bold text-lg mb-3 text-gray-700">3 Bengkel Terdekat</h2>
                <div className="space-y-3">
                  {nearestBengkels.map((bengkel, index) => (
                    <div 
                      key={index} 
                      className={`bg-white rounded-lg shadow p-3 border border-l-4 ${
                        index === 0 ? 'border-l-green-500' : 'border-l-blue-400'
                      } hover:shadow-md transition-shadow`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className={`font-bold ${index === 0 ? 'text-green-700' : 'text-gray-700'}`}>
                            {index === 0 && (
                              <span className="inline-block bg-green-100 text-green-800 text-xs font-semibold mr-2 px-2 py-0.5 rounded">
                                Terdekat
                              </span>
                            )}
                            {bengkel.properties.nama}
                          </h3>
                          
                          <p className="text-sm text-gray-600 mt-1 flex items-center">
                            <svg className="w-3 h-3 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                            {bengkel.properties.alamat}
                          </p>
                          
                          <div className="flex items-center mt-1">
                            <svg className="w-3 h-3 mr-1 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8-2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            <span className="text-xs font-medium text-gray-600">{bengkel.properties.rating}</span>
                            
                            <span className="mx-2 text-gray-300">|</span>
                            
                            <svg className="w-3 h-3 mr-1 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-xs text-gray-600">
                              {bengkel.properties.jam_buka} - {bengkel.properties.jam_tutup}
                            </span>
                            
                            <span className="mx-2 text-gray-300">|</span>
                            
                            <svg className="w-3 h-3 mr-1 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span className="text-xs text-gray-600">{bengkel.properties.jlh_mkanik} Mekanik</span>
                          </div>
                        </div>
                        
                        <span className="bg-blue-50 text-blue-700 text-xs font-semibold px-2 py-1 rounded-full">
                          {formatDistance(bengkel.distance)}
                        </span>
                      </div>
                      
                      <div className="mt-2 pt-2 border-t border-gray-100 flex space-x-2">
                        <a 
                          href={`https://www.google.com/maps/dir/?api=1&destination=${bengkel.geometry.coordinates[1]},${bengkel.geometry.coordinates[0]}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
                        >
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                          </svg>
                          Petunjuk
                        </a>
                        
                        <button 
                          onClick={() => flyToBengkel(bengkel, geojson.features.findIndex(f =>
                            f.properties.nama === bengkel.properties.nama &&
                            f.properties.alamat === bengkel.properties.alamat
                          ))}
                          className="text-xs text-green-600 hover:text-green-800 flex items-center"
                        >
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Lihat di Peta
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            
            {isLoading && (
              <div className="bg-white bg-opacity-90 rounded-lg shadow-sm p-4 text-center my-4 border border-blue-100">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-700 mx-auto"></div>
                <p className="text-sm text-gray-600 mt-3 font-medium">{loadingMessage}</p>
              </div>
            )}

            {/* About This Project Card */}
            <div className="mb-6 bg-white rounded-lg shadow-sm p-4 border border-blue-100">
              <h2 className="font-bold text-lg mb-2 text-blue-700">Tentang Project Ini</h2>
              <p className="text-sm text-gray-700 mb-2">
                <b>Peta SiTempel</b> Aplikasi ini membantu Anda menemukan lokasi tambal ban terdekat secara cepat dan akurat menggunakan teknologi GIS dan GPS. Cocok untuk pengendara yang mengalami ban bocor di perjalanan dan butuh solusi cepat tanpa harus bertanya atau mencari manual.
              </p>
              <ul className="text-xs text-gray-500 list-disc ml-5 mb-2">
                <li>Data lokasi tambal ban diambil dari file <code>bengkel.geojson</code>.</li>
                <li>Teknologi: React, Leaflet, TailwindCSS.</li>
                <li>Fitur: pencarian lokasi, navigasi, dan info detail bengkel.</li>
              </ul>
              <span className="inline-block bg-blue-50 text-blue-700 text-xs font-semibold px-2 py-1 rounded-full">
                SIG Project 2025
              </span>
            </div>

            {/* About Me Card */}
            <div className="mb-6 bg-white rounded-lg shadow-sm p-4 border border-green-100">
              <div className="flex items-center mb-2">
                <img
                  src="https://avatars.githubusercontent.com/u/40624866?v=4"
                  alt="Rendio Simamora"
                  className="w-10 h-10 rounded-full mr-2 border border-green-200"
                />
                <div>
                  <div className="font-semibold text-gray-800">Rendio Simamora</div>
                  <div className="text-xs text-gray-500">@rndio</div>
                </div>
              </div>
              <p className="text-sm text-gray-700">
                Software Engineer Intern at PT Perkebunan Nusantara IV Regional II | Undergraduate Software Engineering Student
              </p>
              <div className="mt-2 flex space-x-2">
                <a
                  href="mailto:mail@rndio.my.id"
                  className="text-xs text-green-600 hover:text-green-800 underline"
                >
                  Email
                </a>
                <a
                  href="https://github.com/rndio"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-gray-600 hover:text-gray-800 underline"
                >
                  GitHub
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Map */}
      <div className="flex-1 h-screen relative">
        <MapContainer
          ref={mapRef}
          key={sidebarOpen ? 'with-sidebar' : 'no-sidebar'}
          center={mapCenter}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          attributionControl={false}
        >
          <ZoomControl position="bottomright" />
          
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="OpenStreetMap">
              <TileLayer 
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
            </LayersControl.BaseLayer>
            
            <LayersControl.BaseLayer name="Satellite">
              <TileLayer 
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" 
                attribution='&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
              />
            </LayersControl.BaseLayer>

            <LayersControl.BaseLayer name="Topographic">
              <TileLayer 
                url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png" 
                attribution='Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
              />
            </LayersControl.BaseLayer>
            
            {showBengkel && geojson && (
              <LayersControl.Overlay checked name="Bengkel">
                <LayerGroup>
                  {geojson.features.map((f, i) => {
                    // Check if this bengkel is in the top 3 nearest
                    const isInTop3 = nearestBengkels.some(b => 
                      b.properties.nama === f.properties.nama && 
                      b.properties.alamat === f.properties.alamat
                    );
                    
                    // Check if this is the nearest bengkel
                    const isNearest = nearest && 
                      nearest.properties.nama === f.properties.nama && 
                      nearest.properties.alamat === f.properties.alamat;
                    
                    // Determine the icon to use
                    const icon = isNearest ? selectedBengkelIcon : bengkelIcon;
                    
                    return (
                      <Marker
                        key={i}
                        position={[f.geometry.coordinates[1], f.geometry.coordinates[0]]}
                        icon={icon}
                        ref={el => markerRefs.current[i] = el}
                      >
                        <Popup className="custom-popup">
                          <div className="p-1">
                            <h3 className={`font-bold text-lg ${isNearest ? 'text-green-600' : 'text-red-600'}`}>
                              {f.properties.nama}
                              {isInTop3 && (
                                <span className="ml-2 inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded-full">
                                  Top 3 Terdekat
                                </span>
                              )}
                            </h3>
                            
                            {/* Alamat */}
                            {f.properties.alamat && (
                              <p className="flex items-start text-gray-600 my-1">
                                <svg className="w-4 h-4 mr-1 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                </svg>
                                <span>{f.properties.alamat}</span>
                              </p>
                            )}
                            
                            {/* Jam Operasional */}
                            {(f.properties.jam_buka || f.properties.jam_tutup) && (
                              <p className="flex items-start text-gray-600 my-1">
                                <svg className="w-4 h-4 mr-1 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>
                                  {f.properties.jam_buka && f.properties.jam_tutup 
                                    ? `${f.properties.jam_buka} - ${f.properties.jam_tutup}`
                                    : f.properties.jam_buka 
                                      ? `Buka: ${f.properties.jam_buka}`
                                      : `Tutup: ${f.properties.jam_tutup}`
                                  }
                                </span>
                              </p>
                            )}
                            
                            {/* Rating */}
                            {f.properties.rating && (
                              <div className="flex items-center text-gray-600 my-1">
                                <svg className="w-4 h-4 mr-1 flex-shrink-0 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8-2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                                <span className="font-medium">{f.properties.rating}</span>
                              </div>
                            )}
                            
                            {/* Mekanik */}
                            {f.properties.jlh_mkanik && (
                              <p className="flex items-center text-gray-600 my-1">
                                <svg className="w-4 h-4 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                <span>{f.properties.jlh_mkanik} Mekanik</span>
                              </p>
                            )}
                            
                            {/* Tombol Navigasi */}
                            <div className="mt-3 pt-2 border-t border-gray-200">
                              <a 
                                href={`https://www.google.com/maps/dir/?api=1&destination=${f.geometry.coordinates[1]},${f.geometry.coordinates[0]}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:text-blue-800 flex items-center font-medium"
                              >
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                </svg>
                                Petunjuk Arah
                              </a>
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </LayerGroup>
              </LayersControl.Overlay>
            )}
            
            {userLocation && (
              <Marker position={userLocation} icon={userIcon}>
                <Popup className="custom-popup">
                  <div className="p-1">
                    <h3 className="font-bold text-blue-600">Lokasi Anda</h3>
                    <p className="text-xs text-gray-500 mt-1">{userLocation[0].toFixed(6)}, {userLocation[1].toFixed(6)}</p>
                  </div>
                </Popup>
              </Marker>
            )}
          </LayersControl>
        </MapContainer>
        <div className="absolute bottom-2 left-2 z-[400] text-xs text-gray-600 bg-white bg-opacity-75 px-2 py-1 rounded shadow-sm">
          &copy; SIG Project | Peta SiTempel
        </div>
      </div>

      {/* Toggle Button */}
      <button
        className={`
          absolute top-4 z-[1100] bg-white p-3 rounded-full shadow-lg transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'left-[320px] md:left-[400px]' : 'left-4'}
        `}
        onClick={toggleSidebar}
        style={{ transition: 'left 0.3s' }}
      >
        {sidebarOpen ? (
          <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        )}
      </button>
    </div>
  )
}

export default App
