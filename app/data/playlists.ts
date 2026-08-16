export interface Track {
  id: string;
  title: string;
  artist: string;
  film?: string;
  year?: number;
  duration: number; // in seconds
  videoId: string;
  audioUrl?: string;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  accentColor: string;
  tracks: Track[];
}

export const PLAYLISTS: Playlist[] = [
  {
    id: "lofi-monsoon",
    name: "Lofi & Melodies",
    description: "Relaxing Hindi Lofi & Soft Romantic Melodies",
    accentColor: "#f43f5e", // Rose / Warm Red
    tracks: [
      { id: "a1", title: "Dard Dilo Ke", artist: "Mohd. Irfan & Himesh Reshammiya", film: "The Xpose", year: 2014, duration: 302, videoId: "NIYznrc4-sA" },
      { id: "a2", title: "Mere Nishan", artist: "Kailash Kher & Meet Bros", film: "OMG Oh My God!", year: 2012, duration: 251, videoId: "wqaF_so8RJs" },
      { id: "a3", title: "Aawaara Angaara", artist: "AR Rahman & Faheem", film: "Tere Ishk Mein", year: 2024, duration: 228, videoId: "uG_p0ULRYho" },
      { id: "a4", title: "Pani Da Rang", artist: "Ayushmann Khurrana", film: "Vicky Donor", year: 2012, duration: 141, videoId: "EiItLWWxgOI" },
      { id: "a5", title: "Tera Rastaa Chhodoon Na", artist: "Amitabh Bhattacharya & Anusha Mani", film: "Chennai Express", year: 2013, duration: 264, videoId: "2PMWLyB4WYo" },
      { id: "a6", title: "Mann Ki Lagan", artist: "Rahat Fateh Ali Khan", film: "Paap", year: 2003, duration: 308, videoId: "lrkaKvhRnEI" },
      { id: "a7", title: "Itni Si Baat Hain", artist: "Arijit Singh & Antara Mitra", film: "Azhar", year: 2016, duration: 210, videoId: "tucWbkH5WX0" },
      { id: "a8", title: "Jo Tum Mere Ho", artist: "Anuv Jain", film: "Single", year: 2024, duration: 258, videoId: "ilNt2bikxDI" },
      { id: "a9", title: "Main Woh Chaand", artist: "Darshan Raval & Himesh Reshammiya", film: "Teraa Surroor", year: 2016, duration: 289, videoId: "8hBQJH2pHQ0" },
      { id: "a10", title: "Maula Maula", artist: "Richa Sharma & Sukhwinder Singh", film: "Singham", year: 2011, duration: 264, videoId: "IMlcwOK5CLI" },
    ],
  },
  {
    id: "90s-nostalgia",
    name: "90s Bollywood Classics",
    description: "Golden Era Classics & Retro Ghazals",
    accentColor: "#f59e0b", // Amber / Warm Gold
    tracks: [
      { id: "b1", title: "Deewana Hua Badal", artist: "Mohammed Rafi & Asha Bhosle", film: "Kashmir Ki Kali", year: 1964, duration: 387, videoId: "0Q5VkLIiTQk" },
      { id: "b2", title: "Isharon Isharon Mein Dil Lenewale", artist: "Mohammed Rafi & Asha Bhosle", film: "Kashmir Ki Kali", year: 1964, duration: 293, videoId: "zNsNuCitZys" },
      { id: "b3", title: "Neele Gagan Ke Tale", artist: "Mahendra Kapoor", film: "Hamraaz", year: 1967, duration: 397, videoId: "cAjqJH4bE_4" },
      { id: "b4", title: "Phirkiwali", artist: "Mohammed Rafi", film: "Raja Aur Runk", year: 1968, duration: 244, videoId: "9G6TSHV6wJA" },
      { id: "b5", title: "Rafta Rafta Woh Meri Hasti Ka", artist: "Mehdi Hassan", film: "Ghazal Classic", year: 1975, duration: 227, videoId: "Y01l7QTtIoE" },
      { id: "b6", title: "Jab Pyar Kiya To Darna Kya", artist: "Lata Mangeshkar", film: "Mughal-E-Azam", year: 1960, duration: 377, videoId: "uASs1_CrBnE" },
      { id: "b7", title: "Chupke Chupke Raat Din", artist: "Ghulam Ali", film: "Ghazal Classic", year: 1982, duration: 482, videoId: "75VnN1dLA-Q" },
      { id: "b8", title: "Hamari Saanson Mein Aaj Tak", artist: "Mehdi Hassan", film: "Ghazal Classic", year: 1978, duration: 305, videoId: "5U4Uc0DnUyc" },
    ],
  },
  {
    id: "punjabi-modern",
    name: "Punjabi Modern Hits",
    description: "Trending Punjabi Beats & Pop Hits",
    accentColor: "#eab308", // Vibrant Gold / Neon Glow
    tracks: [
      { id: "c1", title: "Jackpot", artist: "Cheema Y & Gur Sidhu", film: "Single", year: 2024, duration: 192, videoId: "yM5APO87aNU" },
      { id: "c2", title: "California Love", artist: "Cheema Y & Gur Sidhu", film: "Single", year: 2023, duration: 157, videoId: "rSxTumD4kew" },
      { id: "c3", title: "Tutor", artist: "Cheema Y & Gur Sidhu", film: "Single", year: 2023, duration: 214, videoId: "CKamNm4y3OU" },
      { id: "c4", title: "Love Salary", artist: "Cheema Y & Gur Sidhu", film: "Single", year: 2024, duration: 177, videoId: "WBYD8BjHO4s" },
      { id: "c5", title: "Champ", artist: "Vikram Sarkar", film: "Single", year: 2026, duration: 168, videoId: "li71nDMXwLs" },
      { id: "c6", title: "The Beast", artist: "Cheema Y & Gur Sidhu", film: "Single", year: 2024, duration: 140, videoId: "dCTDna2vf1I" },
      { id: "c7", title: "Mi Amor", artist: "Sharn & Meet", film: "Single", year: 2025, duration: 226, videoId: "z1VdU6ZwRwY" },
      { id: "c8", title: "Banda Bamb", artist: "Jordan Sandhu", film: "Single", year: 2025, duration: 184, videoId: "YOQLbW9NeBM" },
      { id: "c9", title: "Into You", artist: "Ariana Grande", film: "Dangerous Woman", year: 2016, duration: 241, videoId: "WHHkVUaOxe4" },
      { id: "c10", title: "Life Style", artist: "Sidhu Moose Wala feat. Banka", film: "Single", year: 2021, duration: 258, videoId: "2JkHn0Kmm3Y" },
      { id: "c11", title: "The Last Ride", artist: "Sidhu Moose Wala & Wazir Patar", film: "Single", year: 2022, duration: 276, videoId: "6xoB4ZiKKn0" },
      { id: "c12", title: "Noor Mahal", artist: "Chani Nattan & Inderpal Moga", film: "Takeover EP", year: 2024, duration: 165, videoId: "enidMo5izlE" },
      { id: "c13", title: "Hypnotic", artist: "Deep Dhaliwal x Anker Deol", film: "Single", year: 2024, duration: 148, videoId: "eBLe3c4oJas" },
      { id: "c14", title: "Her", artist: "Shubh", film: "Single", year: 2023, duration: 155, videoId: "eD3TP-C3nYE" },
      { id: "c15", title: "Moves", artist: "Shubh", film: "Single", year: 2024, duration: 160, videoId: "tlkb3cLfaOQ" },
    ],
  },
];
