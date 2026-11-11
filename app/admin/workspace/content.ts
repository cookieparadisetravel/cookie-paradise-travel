export type WorkspacePhoto = { id: string; title: string; alt: string; position: string; src: string };
export const quotes = [
  {
    "text": "Dân tộc Việt Nam có bước tới đài vinh quang để sánh vai với các cường quốc năm châu được hay không?",
    "author": "Hồ Chí Minh",
    "source": "https://baotanghochiminh.vn/chu-tich-ho-chi-minh-gui-thu-cho-hoc-sinh-ca-nuoc-nhan-ngay-khai-truong-dau-tien-cua-nuoc-viet-nam-dan-chu-cong-hoa.htm",
    "label": "Bảo tàng Hồ Chí Minh",
    "lang": "vi"
  },
  {
    "text": "Stay hard.",
    "author": "David Goggins",
    "source": "https://www.hubermanlab.com/episode/david-goggins-how-to-build-immense-inner-strength",
    "label": "Huberman Lab",
    "lang": "en"
  },
  {
    "text": "But if something’s important enough then you do it even though the risk of failure is high.",
    "author": "Elon Musk",
    "source": "https://archive.computerhistory.org/resources/access/text/2014/03/102746849-05-01-acc.pdf",
    "label": "Computer History Museum",
    "lang": "en"
  },
  {
    "text": "You want to become a master at overcoming hard moments. That to me is the sign of a champion.",
    "author": "Roger Federer",
    "source": "https://home.dartmouth.edu/news/2024/06/2024-commencement-address-roger-federer",
    "label": "Dartmouth",
    "lang": "en"
  },
  {
    "text": "Nhiệm vụ nào cũng hoàn thành, khó khăn nào cũng vượt qua, kẻ thù nào cũng đánh thắng.",
    "author": "Hồ Chí Minh",
    "source": "https://baotanghochiminh.vn/bien-nien-tieu-su/p-859.htm",
    "label": "Bảo tàng Hồ Chí Minh",
    "lang": "vi"
  },
  {
    "text": "I’m a big believer in doing things that make you uncomfortable.",
    "author": "David Goggins",
    "source": "https://bigthink.com/health/david-goggins-how-to-strengthen-your-mind-like-a-navy-seal/",
    "label": "Big Think",
    "lang": "en"
  },
  {
    "text": "And so rock bottom became the solid foundation on which I rebuilt my life.",
    "author": "J.K. Rowling",
    "source": "https://news.harvard.edu/gazette/story/2008/06/text-of-j-k-rowling-speech/",
    "label": "Harvard",
    "lang": "en"
  },
  {
    "text": "I don’t ever give up. I mean, I’d have to be dead or completely incapacitated.",
    "author": "Elon Musk",
    "source": "https://www.cbsnews.com/news/spacex-entrepreneurs-race-to-space/",
    "label": "CBS · 60 Minutes",
    "lang": "en"
  },
  {
    "text": "Thần tốc, thần tốc hơn nữa, táo bạo, táo bạo hơn nữa.",
    "author": "Đại tướng Võ Nguyên Giáp",
    "source": "https://www.hvcsnd.edu.vn/50-nam-buc-mat-lenh-than-toc-than-toc-hon-nua-13057",
    "label": "Học viện Cảnh sát nhân dân",
    "lang": "vi"
  },
  {
    "text": "Sometimes life’s gonna hit you in the head with a brick. Don’t lose faith.",
    "author": "Steve Jobs",
    "source": "https://news.stanford.edu/stories/2005/06/youve-got-find-love-jobs-says",
    "label": "Stanford",
    "lang": "en"
  },
  {
    "text": "It’s by constantly facing the things that you don’t want to face.",
    "author": "David Goggins",
    "source": "https://bigthink.com/health/david-goggins-how-to-strengthen-your-mind-like-a-navy-seal/",
    "label": "Big Think",
    "lang": "en"
  },
  {
    "text": "Discipline equals freedom.",
    "author": "Jocko Willink",
    "source": "https://jocko.com/about/",
    "label": "Jocko Willink",
    "lang": "en"
  }
] as const;
export const landscapes = [
  {
    "id": "trang-an",
    "name": "Tràng An · Ninh Bình",
    "alt": "A waterside pavilion beneath the green limestone mountains of Tràng An",
    "credit": "Rowan Heuvel",
    "url": "https://unsplash.com/photos/pagoda-surrounded-by-body-of-water-and-mountains-PgSxHidgJHQ",
    "fresh": true,
    "src": "/workspace/trang-an.webp"
  },
  {
    "id": "ban-gioc",
    "name": "Thác Bản Giốc",
    "alt": "Bản Giốc waterfall pouring through mist beneath a leafy canopy",
    "credit": "Mayur Arvind",
    "url": "https://unsplash.com/photos/a-majestic-waterfall-cascades-down-a-lush-green-cliff-4k9Zu1jPqDU",
    "fresh": true,
    "src": "/workspace/ban-gioc.webp"
  },
  {
    "id": "nho-que",
    "name": "Sông Nho Quế · Hà Giang",
    "alt": "A boat on the turquoise Nho Quế River between steep green canyon walls",
    "credit": "Harry Le",
    "url": "https://unsplash.com/photos/a-boat-travels-on-a-river-between-steep-green-mountains-T8pZ0JepBkg",
    "fresh": true,
    "src": "/workspace/nho-que.webp"
  },
  {
    "id": "phong-nha",
    "name": "Phong Nha",
    "alt": "The river, fields, village and green limestone mountains of Phong Nha seen from above",
    "credit": "Florian Delée",
    "url": "https://unsplash.com/photos/river-flows-through-a-lush-green-valley-with-mountains-4GvrRCL0OZU",
    "fresh": true,
    "src": "/workspace/phong-nha.webp"
  },
  {
    "id": "mekong",
    "name": "Miền Tây · Mekong Delta",
    "alt": "A quiet waterway framed by arching palms in the Mekong Delta",
    "credit": "Rowan Heuvel",
    "url": "https://unsplash.com/photos/river-surrounded-by-palm-trees-DL2M6z4OuGA",
    "fresh": true,
    "src": "/workspace/mekong.webp"
  },
  {
    "id": "hai-van",
    "name": "Bờ biển Hải Vân",
    "alt": "A broad sandy beach and blue sea viewed from Hải Vân Pass",
    "credit": "Fernando Strabuli",
    "url": "https://unsplash.com/photos/a-view-of-a-beach-with-mountains-in-the-background-WUCZPfpEV0g",
    "fresh": true,
    "src": "/workspace/hai-van.webp"
  },
  {
    "id": "terraces",
    "name": "Mù Cang Chải",
    "alt": "Golden rice terraces and mist in the mountains of Mù Cang Chải",
    "credit": "Hoach Le Dinh",
    "url": "https://unsplash.com/photos/rice-terraces-in-mu-cang-chai-PeRt3uMmjYM",
    "src": "/workspace/terraces.webp"
  },
  {
    "id": "bay",
    "name": "Hạ Long",
    "alt": "Limestone islands and boats in misty Hạ Long Bay",
    "credit": "Warren",
    "url": "https://unsplash.com/photos/boat-surrounder-by-islands--HtfdIHSbsE",
    "src": "/workspace/bay.webp"
  },
  {
    "id": "hoi-an",
    "name": "Hội An",
    "alt": "Lanterns illuminate a street in Hội An at night",
    "credit": "Juup Schram",
    "url": "https://unsplash.com/photos/oBu2jRDmMNk",
    "src": "/workspace/hoi-an.webp"
  },
  {
    "id": "hue",
    "name": "Huế · Đại Nội",
    "alt": "The Imperial Citadel in Huế",
    "credit": "Nguyen Minh",
    "url": "https://unsplash.com/photos/lzjlYsMGYXg",
    "src": "/workspace/hue.webp"
  }
] as const;
