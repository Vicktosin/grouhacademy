"use client";

import Script from "next/script";

const PROVESOURCE_API_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOiI2YTk5OWRlMDM5ZjBjZDRjMDY0YzkzNDEiLCJpYXQiOjE3ODg0NTIzMjB9.zEZFlpu4TzUiWwqaPHjlIoSaZ2GWZQMYz_Hyafz5p-s";

export default function ProveSource() {
  return (
    <Script
      id="provesource"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
          !function(o,i){window.provesrc&&window.console&&console.error&&console.error("ProveSource is included twice in this page."),window.provesrc={dq:[],display:function(){this.dq.push(arguments)}},o._provesrcAsyncInit=function(){window.provesrc.init({apiKey:"${PROVESOURCE_API_KEY}",v:"0.0.4"})};var r=i.createElement("script");r.type="text/javascript",r.async=!0,r["ch"+"ar"+"set"]="UTF-8",r.src="https://cdn.provesrc.com/provesrc.js";var e=i.getElementsByTagName("script")[0];e.parentNode.insertBefore(r,e)}(window,document);
        `,
      }}
    />
  );
}
