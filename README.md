# What a Duck!

DuckDuckGo's bang redirects are too slow. Add the following URL as a custom search engine to your browser. Enables all of DuckDuckGo's bangs to work, but much faster.

```
https://whataduck.vercel.app?q=%s
```

## How is it that much faster?

DuckDuckGo does their redirects server side. Their DNS is...not always great. Result is that it often takes ages.

I solved this by doing all of the work client side. Once you've went to https://whataduck.vercel.app once, the JS is all cache'd and will never need to be downloaded again. Your device does the redirects, not me.  
*If you don't trust, then use this once and make your device offline and see the magic.*
