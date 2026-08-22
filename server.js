मेरे GitHub repository "cr-clean-ai" को पूरा ठीक करो।

IMPORTANT:
मुझे अलग-अलग छोटे code नहीं चाहिए।
पूरे project को जांचकर आवश्यक files में एक साथ बदलाव करो।
मौजूदा काम करने वाले features को बिना जरूरत हटाना नहीं है।

मेरी समस्या:
Render पर website खुलने पर "Cannot GET /" आ रहा था।

Repository में ये files हैं:
- index.html
- style.css
- app.js
- server.js
- package.json
- Dockerfile
- README.md

मुख्य समस्या यह है कि मेरी index.html repository के ROOT में है, जबकि server.js में public folder को static directory बनाया गया है। इसलिए root website सही तरह serve नहीं हो रही।

इन सभी कामों को एक साथ करो:

1. server.js को ठीक करो।

Express server को इस तरह configure करो कि:
- JSON requests काम करें।
- / route खोलने पर root की index.html खुले।
- CSS और JavaScript files भी सही तरीके से load हों।
- API routes काम करते रहें।
- PORT environment variable इस्तेमाल हो।
- Render पर server 0.0.0.0 पर सही तरीके से listen करे।

अगर index.html root में है तो:
app.get("/", ...)
के द्वारा root index.html serve करो।

सही path के लिए __dirname इस्तेमाल करो।

2. अगर server.js में यह गलत static path है:
app.use(express.static(path.join(__dirname, "public")));

तो उसे ऐसी व्यवस्था से बदलो जिससे root में मौजूद index.html, style.css और app.js काम करें।

उदाहरण के लिए जरूरत के अनुसार:
app.use(express.static(__dirname));

लेकिन API routes को static files से conflict नहीं होना चाहिए।

3. "Cannot GET /" की समस्या पूरी तरह खत्म करो।

4. Dockerfile को भी जांचो।

Dockerfile में "public" folder को COPY करने की कोशिश हो और repository में public folder मौजूद नहीं है, तो उसे ठीक करो।

विशेष रूप से अगर ऐसा कुछ है:
COPY public ./public

तो इसे हटाकर repository की वास्तविक structure के अनुसार Dockerfile बनाओ।

Docker image में ये files उपलब्ध होनी चाहिए:
- index.html
- style.css
- app.js
- server.js
- package.json

5. package.json जांचो।

सुनिश्चित करो कि:
- express dependency मौजूद हो।
- multer और बाकी server.js में इस्तेमाल होने वाली dependencies मौजूद हों।
- start script मौजूद हो।

Start command Node server को चलाए, उदाहरण:
"start": "node server.js"

6. server.js में मौजूद FFmpeg functionality को बिना जरूरत हटाना नहीं है।

अगर FFmpeg इस्तेमाल हो रहा है तो:
- ffmpeg command उपलब्ध होने की जांच करो।
- existing video processing API को बनाए रखो।
- upload API को बनाए रखो।
- processing status API को बनाए रखो।
- download API को बनाए रखो।

7. Security और error handling बनाए रखो।

- invalid upload पर proper error दें।
- missing file पर error दें।
- server crash न हो।
- temporary files को जरूरत के बाद साफ करें।

8. Render deployment के लिए project तैयार करो।

Render में किसी खास local path पर निर्भरता नहीं होनी चाहिए।

PORT environment variable इस्तेमाल करो:
const PORT = process.env.PORT || 3000;

और server को:
app.listen(PORT, "0.0.0.0", ...)

के साथ चलाओ।

9. Frontend index.html को root URL "/" से खोलने पर पूरा interface दिखाई देना चाहिए।

CSS:
style.css

JavaScript:
app.js

सही relative paths से load होने चाहिए।

10. मौजूदा project की functionality को बचाते हुए केवल जरूरी बदलाव करो।

11. सभी files को आपस में compatible बनाओ।

12. अंतिम रूप से project structure ऐसा होना चाहिए:

cr-clean-ai/
├── index.html
├── style.css
├── app.js
├── server.js
├── package.json
├── Dockerfile
└── README.md

public folder की जरूरत नहीं है, जब तक code में वास्तव में उसकी जरूरत न हो।

13. सबसे महत्वपूर्ण:
मुझे केवल explanation मत दो।
Repository की files में आवश्यक बदलाव करके पूरा working version तैयार करो।

14. कोई duplicate server, duplicate route या duplicate dependency मत बनाओ।

15. पुराने गलत code को हटाकर साफ और working code रखो।

16. Build और Render deployment में error नहीं आना चाहिए।

17. अंत में मुझे साफ बताओ:
- कौन-कौन सी files बदलीं
- क्या समस्या थी
- क्या ठीक किया
- Render पर website किस URL से खुलेगी

TARGET:
https://cr-clean-ai.onrender.com

लक्ष्य यह है कि URL खोलने पर "Cannot GET /" नहीं आए, बल्कि मेरी CR Clean AI website खुले और frontend तथा backend दोनों काम करें।
