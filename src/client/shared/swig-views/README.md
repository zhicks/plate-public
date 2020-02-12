## Some notes about swig-views
### Last updated July 25 2016

* These are views rendered by the server. 
* These are placed in the dist folder but are not public.
* We have plate, outside, and plain as prefixes.
    * Plate is for the Plate app
    * Outside is for the landing page and etc - it will have some Angular
    * Plain is for pages that will not have Angular (jQuery still ok)
* auth-callback is for provider callbacks - it places the JWT in local memory and forwards to /p
* pieces is for stuff like the header and footer
    * It's mostly stuff that's outside since most stuff in Plate app will be rendered by Angular.