/* eslint-disable no-console */

/*
    Import
*/

import { request, RequestUrlParam  } from 'obsidian'
import GistrPlugin from 'src/main'
import { Env, PID } from 'src/api'
import { GistrSettings } from 'src/settings/settings'
import { lng } from 'src/lang'
import { SaturynHandleSyntax } from 'src/api/Saturyn'

/*
    Basic Declrations
*/

const sender        = PID( )

/*
    Interface > Json
*/

export interface ItemJSON
{
    embed:          Record<string, string>,
    files:          Record<string, string>,
    description:    string,
    created_at:     string,
    id:             string,
    owner:          string,
    title:          string,
    uuid:           string,
    visibility:     string,
    stylesheet:     string
    div:            string,
}

/*
    Interface > User Style Properties
*/

type StyleProperties = Record<string, string>

/*
    Is Empty
*/

const bIsEmpty = ( val: unknown ): val is null | undefined =>
val === undefined || val === null

/*
    Gistr Backend
*/

export class BackendCore
{
    private readonly settings:  GistrSettings
    private manifest:           Env
    private plugin:             GistrPlugin

    constructor( settings: GistrSettings, plugin: GistrPlugin )
    {
        this.plugin     = plugin
        this.settings   = settings
        this.manifest   = Env
    }

    /*
        Gist > Handle
    */

    private async GistHandle( plugin: GistrPlugin, el: HTMLElement, data: string )
    {

        /*
            Method > New
            supports a multi-lined structure in the code block
        */

        let n_url               = undefined
        let n_file              = undefined
        let n_bg                = undefined
        let n_theme             = undefined
        let n_textcolor         = undefined
        let n_raw               = undefined
        let n_height            = undefined
        let n_zoom              = undefined
        let n_css               = undefined

        const pattern_new       = /^(?=\b(?:url|file|background|color|theme|title|raw|height|zoom|css):)(?=(?:[^`]*?\burl:? +(?<url>[^`\n]*)|))(?=(?:[^`]*?\bfile:? +(?<file>[^`\n]*)|))(?=(?:[^`]*?\bbackground:? +(?<background>[^`\n]*)|))(?=(?:[^`]*?\bcolor:? +(?<color>[^`\n]*)|))(?=(?:[^`]*?\btheme:? +(?<theme>[^`\n]*)|))(?=(?:[^`]*?\btitle:? +(?<title>[^`\n]*)|))(?=(?:[^`]*?\braw:? +(?<raw>[^`\n]*)|))(?=(?:[^`]*?\bheight:? +(?<height>[^`\n]*)|))(?=(?:[^`]*?\bzoom:? +(?<zoom>[^`\n]*)|))(?=(?:[^`]*?\bcss:? +(?<css>[^`]*)|))(?:.+\n){0,9}.+/

        if ( data.match( pattern_new )?.groups )
        {
            const find_new      = data.match( pattern_new ).groups

            n_url               = find_new.url
            n_file              = find_new.file
            n_bg                = find_new.background
            n_theme             = find_new.theme
            n_textcolor         = find_new.color
            n_raw               = find_new.raw ?? false
            n_height            = find_new.height ?? 700
            n_zoom              = find_new.zoom ?? 1
            n_css               = find_new.css ?? ''
        }

        /*
            Format new method into old method
                source will be ran through the old method regex to break the URL up into the segments:
                    - protocol, host, username, uuid, filename, theme
        */

        const source            = !bIsEmpty( n_url ) ? n_url : data

        /*
            Raw website functionality.
            Because Github / Gists don't support integrated mermaid charts, we must display the charts as their own browser window.
            Give the user control to modify things such as zoom, height, etc.
        */

        if ( n_raw )
        {

            n_css = n_css.replace( /(\r\n|\n|\r|\||\s)/gm, '' )

            const raw_output =
            `
url:  ${ n_url }
height: ${ n_height }
zoom:  ${ n_zoom }
css: |
   ${ n_css }
            `

            const pnl = SaturynHandleSyntax( plugin, raw_output )
            el.appendChild( pnl )
            return
        }

        /*
            Method > Old
            A single-lined URL for an embedded gist
        */

        const pattern       = /(?<protocol>https?:\/\/)?(?<host>[^/]+\/)?((?<username>[\w-]+)\/)?(?<uuid>\w+)(#(?<filename>.+))?(&(?<theme>\w+))?/
        const find          = source.match( pattern ).groups

        /*
            usage values
                both new and old method should be broken up into the following groups
        */

        const host          = find.host                 // gist.github.com/
        const username      = find.username             // Username
        const uuid          = find.uuid                 // 5100a123b1cdef1a2b3c4d58fe54ffacd
        const file          = find.filename ?? n_file   // file1.md
        const theme         = find.theme ?? n_theme     // light || dark

        /*
            Since opengist can really be any website, check for matching github links
        */

        const bMatchGithub  = /((https?:\/\/)?(.+?\.)?github\.com(\/[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=]*)?)/g.test( host )

        /*
            No UUID match
        */

        if ( bIsEmpty( host ) || bIsEmpty( uuid ) )
            return this.ThrowError( el, data, lng( 'err_gist_loading_fail_url', host ) )

        /*
            compile url to gist
        */

        const gistSrcURL  = !bIsEmpty( file ) ? `https://${ host }${ username }/${ uuid }.json?file=${ file }` : `https://${ host }${ username }/${ uuid }.json`

        /*
            Dev > print gist url
        */

        if ( process.env.BUILD === 'dev' )
            console.log( gistSrcURL )

        /*
            This should be a theme specified by the user in the codeblock; NOT their theme setting

            blank if none
        */

        const og_ThemeOV = !bIsEmpty( theme ) ? theme : ''

        /*
            assign style values
        */

        const styles:StyleProperties  = { }
        styles.background   = n_bg
        styles.theme        = og_ThemeOV
        styles.color_text   = n_textcolor

        /*
            handle error
        */

        const reqUrlParams: RequestUrlParam = { url: gistSrcURL, method: 'GET', headers: { Accept: 'application/json' } }
        try
        {
            const req       = await request( reqUrlParams )
            const json      = JSON.parse( req ) as ItemJSON

            return this.GistGenerate( plugin, el, host, uuid, json, bMatchGithub, styles )
        }
        catch ( err )
        {
            return this.ThrowError( el, data, `Invalid gist url ${ gistSrcURL } ( ${ err } )` )
        }
    }

    /*
        Gist > Generate

        create new iframe for each gist, assign it a uid, set the needed attributes, and generate the css, js
    */

    private EventListener( uuid: string ) : string
    {
        return `
        <script>
            window.addEventListener( 'load', ( ) =>
            {
                window.top.postMessage(
                {
                    sender:         '${ sender }',
                    gid:            '${ uuid }',
                    scrollHeight:   document.body.scrollHeight
                }, '${ Env.pluginBase }')
            } )
        </script>
        `
    }

    /*
        Gist > Generate

        create new iframe for each gist, assign it a uid, set the needed attributes, and generate the css, js
    */

    private async GistGenerate( plugin: GistrPlugin, el: HTMLElement, host: string, uuid: string, json: ItemJSON, bGithub: boolean, style: StyleProperties )
    {

        /*
            create uuid and iframe
        */

        const gid               = `${ sender }-${ uuid }-${ plugin.generateUuid( ) }`
        const ct_iframe         = document.createElement( 'iframe' )
        ct_iframe.id            = gid

        ct_iframe.classList.add ( `${ sender }-container` )
        ct_iframe.setAttribute  ( 'sandbox',    'allow-scripts allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation' )
        ct_iframe.setAttribute  ( 'loading',    'lazy' )
        ct_iframe.setAttribute  ( 'width',      '100%' )

        /*
            https://fonts.googleapis.com

            policy directive error if certain attributes arent used. doesnt affect the plugin, but erors are bad
        */

        ct_iframe.setAttribute      ( 'csp', 'default-src * data: blob: \'unsafe-inline\' \'unsafe-eval\'; script-src * \'unsafe-inline\' \'unsafe-eval\'; connect-src * \'unsafe-inline\'; img-src * data: blob: \'unsafe-inline\'; frame-src *; style-src * \'unsafe-inline\';' )

        /*
            assign css, body, js
        */

        const css_theme_ovr     = ( style.theme !== '' ) ? style.theme.toLowerCase( ) : ''
        const css_theme_sel     = ( css_theme_ovr !== '' ) ? css_theme_ovr : ( this.settings.theme.toLowerCase( ) === 'dark' ) ? 'dark' : ( this.settings.theme.toLowerCase( ) === 'light' ) ? 'light'  : 'light'
        let css_og              = ''
        let css_gh              = ''

        const content_css       = await this.GetCSS( el, uuid, ( bGithub ? json.stylesheet : json.embed.css ) )
        const content_body      = ( bGithub ? json.div : '' )
        const content_js        = ( bGithub ? '' : await this.GetJavascript( el, uuid, ( css_theme_sel === 'dark' ? json.embed.js_dark : json.embed.js ) ) )

        /*
            Declare custom css override
        */

        const css_override      = ( ( bGithub && this.settings.css_gh && this.settings.css_gh.length > 0 ) ? ( this.settings.css_gh ) : ( this.settings.css_og && this.settings.css_og.length > 0 && this.settings.css_og ) ) || ''

        /*
            Update style theme value
        */

        style.theme = css_theme_sel

        /*
            OpenGist & Github specific CSS

            @note       : these are edits the user should not need to edit.
                          OpenGist needs these edits in order to look right with the header
                          and footer.

                          obviously this condition doesn't matter even if it is injected into Github pastes,
                          but it would be usless code.

                          working with OpenGist developer to re-do the HTML generated when embedding a gist.
        */

        const css_og_append     = this.CSS_Get_OpenGist( style )
        const css_gh_append     = this.CSS_Get_Github( style )

        /*
            Github > Dark Theme
        */

        if ( bGithub === false )
            css_og = css_og_append
        else
            css_gh = css_gh_append

        /*
            generate html output
        */

        const html_output =
        `
        <html>
            <head>
                <style>
                    html, body { height: 100%; margin: 0; padding: 0; }
                </style>

                ${ this.EventListener( gid ) }

                <style>
                    ${ content_css }
                </style>

                <! –– Injected CSS ––>
                <style>
                ${ css_override }
                ${ css_og }
                ${ css_gh }
                </style>

                <script>
                    ${ content_js }
                </script>

            </head>

            <body class="gistr-theme-${ css_theme_sel }">
                ${ content_body }
            </body>
        </html>
        `

        ct_iframe.srcdoc = html_output
        el.appendChild( ct_iframe )
    }

    /*
        Theme > OpenGist
    */

    private CSS_Get_OpenGist( style: StyleProperties )
    {

        const css_og_bg_color       = ( style.theme === 'dark' ? this.settings.og_clr_bg_dark : this.settings.og_clr_bg_light )
        const css_og_sb_color       = ( style.theme === 'dark' ? this.settings.og_clr_sb_dark : this.settings.og_clr_sb_light )
        const css_og_bg_header_bg   = ( style.theme === 'dark' ? 'rgb( 35 36 41/var( --tw-bg-opacity ) )' : 'rgb( 238 239 241/var( --tw-bg-opacity ) )' )
        const css_og_bg_header_bor  = ( style.theme === 'dark' ? '1px solid rgb( 54 56 64/var( --tw-border-opacity ) )' : 'rgb( 222 223 227/var( --tw-border-opacity ) )' )
        const css_og_bg             = ( !bIsEmpty( style.background ) ? 'url(' + style.background + ')' : css_og_bg_color )
        const css_og_tx_color       = ( style.theme === 'dark' ? this.settings.og_clr_tx_dark : this.settings.og_clr_tx_light )
        let css_og_tx_color_user    = ( !bIsEmpty( style.color_text ) ? style.color_text : css_og_tx_color )
        css_og_tx_color_user        = css_og_tx_color_user.replace( '#', '' )
        const css_og_wrap           = ( this.settings.textwrap === 'Enabled' ? 'pre-wrap' : 'pre' )
        const css_og_opacity        = ( this.settings.og_opacity ) || 1

        return `
        ::-webkit-scrollbar
        {
            width:                  6px;
            height:                 10px;
        }

        ::-webkit-scrollbar-track
        {
            background-color:       transparent;
            border-radius:          5px;
            margin:                 1px;
        }

        ::-webkit-scrollbar-thumb
        {
            border-radius:          10px;
            background-color:       ${ css_og_sb_color };
        }

        .dark:bg-gray-900
        {
            background-color:       ${ css_og_bg_color } !important;
        }

        .opengist-embed .dark\:bg-gray-900:is(.dark *)
        {
            background-color:       ${ css_og_bg_color } !important;
        }

        .opengist-embed .code
        {
            padding-top:            ${ this.settings.blk_pad_t }px;
            padding-bottom:         ${ this.settings.blk_pad_b }px;
            border-top:             ${ css_og_bg_header_bor };
            background-color:       ${ css_og_bg_color } !important;
            width:                  fit-content;
            margin-top:             -1px;
            background:             ${ css_og_bg };
            background-size:        cover;
        }

        .opengist-embed .mb-4
        {
            margin-bottom:          1rem;
            backdrop-filter:        opacity(0);
            --tw-bg-opacity:        1;
            background-color:       ${ css_og_bg_header_bg };
            opacity:                ${ css_og_opacity };
        }

        .opengist-embed .line-code
        {
            color:                  #${ css_og_tx_color_user };
        }

        .opengist-embed .code .line-num
        {
            color:                  #${ css_og_tx_color_user };
            opacity:                0.5;
        }

        .opengist-embed .code .line-num:hover
        {
            color:                  #${ css_og_tx_color_user };
            opacity:                1;
        }

        .opengist-embed .whitespace-pre
        {
            white-space:            ${ css_og_wrap };
        }
        `
    }

    /*
        Theme > Github
    */

    private CSS_Get_Github( style: StyleProperties )
    {

        const css_gh_bg_color       = ( style.theme === 'dark' ? this.settings.gh_clr_bg_dark : this.settings.gh_clr_bg_light )
        const css_gh_sb_color       = ( style.theme === 'dark' ? this.settings.gh_clr_sb_dark : this.settings.gh_clr_sb_light )
        const css_gh_bg_header_bg   = ( style.theme === 'dark' ? 'rgb( 35 36 41/var( --tw-bg-opacity ) )' : 'rgb( 238 239 241/var( --tw-bg-opacity ) )' )
        const css_gh_bg_header_bor  = ( style.theme === 'dark' ? '1px solid rgb( 54 56 64/var( --tw-border-opacity ) )' : 'rgb( 222 223 227/var( --tw-border-opacity ) )' )
        const css_gh_bg             = ( !bIsEmpty( style.background ) ? 'url(' + style.background + ')' : css_gh_bg_color )
        const css_gh_tx_color       = ( style.theme === 'dark' ? this.settings.og_clr_tx_dark : this.settings.og_clr_tx_light )
        let css_gh_tx_color_user    = ( !bIsEmpty( style.color_text ) ? style.color_text : css_gh_tx_color )
        css_gh_tx_color_user        = css_gh_tx_color_user.replace( '#', '' )
        const css_gh_wrap           = ( this.settings.textwrap.toLowerCase( ) === 'enabled' ? 'wrap' : 'nowrap' )
        const css_gh_opacity        = ( this.settings.gh_opacity ) || 1

        return `
        ::-webkit-scrollbar
        {
            width:                  6px;
            height:                 10px;
        }

        ::-webkit-scrollbar-track
        {
            background-color:       transparent;
            border-radius:          5px;
            margin:                 1px;
        }

        ::-webkit-scrollbar-thumb
        {
            border-radius:          10px;
            background-color:       ${ css_gh_sb_color };
        }

        body
        {
            --tw-bg-opacity:        1;
            --tw-border-opacity:    1;
        }

        body .gist .gist-file
        {
            backdrop-filter:        opacity( 0 );
            background-color:       rgb( 35 36 41/var( --tw-bg-opacity ) );
            border:                 2px solid rgba( 255, 255, 255, 0.1 );
            opacity:                ${ css_gh_opacity };
        }

        body .gist .gist-data
        {
            padding-left:           12px;
            padding-right:          12px;
            padding-top:            15px;
            padding-bottom:         6px;
            border-color:           ${ css_gh_bg_header_bor };
            background-color:       ${ css_gh_bg_color };
            background:             ${ css_gh_bg };
            background-size:        cover;
            background-size:        cover;
        }

        .gist .markdown-body>*:last-child
        {
            margin-bottom: 0 !important;
            padding-bottom: 5px;
        }

        body .gist .markdown-body
        {
            color:                  ${ css_gh_tx_color };
            line-height:            18.2px;
            font-size:              0.8em;
            border-spacing:         0;
            border-collapse:        collapse;
            font-family:            Menlo,Consolas,Liberation Mono,monospace;
        }

        body .gist .gist-meta
        {
            color:                  #6b869f;
            border-top:             ${ css_gh_bg_header_bor };
            background-color:       ${ css_gh_bg_header_bg };
            padding-left:           22px;
            padding-right:          16px;
            padding-top:            8px;
            padding-bottom:         8px;
        }

        body .gist .gist-meta a
        {
            color:                  rgb( 186 188 197/var( --tw-text-opacity ) );
            opacity:                0.9;
        }

        body .gist .gist-meta a.Link--inTextBlock:hover
        {
            color:                  ${ css_gh_tx_color };
            opacity:                0.5;
        }

        body .gist .gist-meta a.Link--inTextBlock
        {
            padding-left:           0px;
            padding-right:          7px;
            color:                  ${ css_gh_tx_color };
        }

        body .gist .gist-meta > a:nth-child( 3 )
        {
            padding-left:           5px;
        }

        body .gist .gist-data .pl-s .pl-s1
        {
            color:                  #a5c261
        }

        body .gist .highlight
        {
            background:             transparent;
        }

        body .gist .blob-wrapper
        {
            padding-bottom:         6px !important;
        }

        body .gist .pl-s2, body .gist .pl-stj, body .gist .pl-vo,
        body .gist .pl-id, body .gist .pl-ii
        {
            color:                  #${ css_gh_tx_color_user };
        }

        body .gist .blob-code
        {
            color:                  #${ css_gh_tx_color_user };
        }

        body .gist .blob-num, body .gist .blob-code-inner,
        {
            color:                  #${ css_gh_tx_color_user };
            opacity:                0.5;
        }

        body .gist .blob-num:hover
        {
            color:                  #${ css_gh_tx_color_user };
            opacity:                1;
        }

        body .gist .blob-wrapper tr:first-child td
        {
            text-wrap:              ${ css_gh_wrap };
        }

        body.gistr-theme-dark .gist .pl-s1
        {
            color:                  #ced2d5;
        }

        body.gistr-theme-dark .gist .pl-s
        {
            color:                  #a5d6ff;
        }

        body.gistr-theme-light .gist .pl-k
        {
            color:                  #bc4c00;
        }

        body.gistr-theme-light .gist .pl-s1
        {
            color:                  #000000;
        }

        body.gistr-theme-light .gist .pl-c1
        {
            color:                  #0550ae;
        }

        body.gistr-theme-light .gist .gist-data
        {
            font-weight:            bold;
        }

        body.gistr-theme-light .gist .pl-en
        {
            color:                  #eb1e73;
        }

        body .gist .pl-enti, body .gist .pl-mb, body .gist .pl-pdb
        {
            font-weight:            700;
        }

        body .gist .pl-c, body .gist .pl-c span, body .gist .pl-pdc
        {
            color:                 #bc9458;
            font-style:            italic;
        }

        body .gist .pl-c1, body .gist .pl-pdc1, body .gist .pl-scp
        {
            color:                 #6c99bb;
        }

        body .gist .pl-ent, body .gist .pl-eoa, body .gist .pl-eoai, body .gist .pl-eoai .pl-pde,
        body .gist .pl-ko, body .gist .pl-kolp, body .gist .pl-mc, body .gist .pl-mr, body .gist .pl-ms,
        body .gist .pl-s3, body .gist .pl-sok
        {
            color:                 #ffe5bb;
        }

        body .gist .pl-mdh, body .gist .pl-mdi, body .gist .pl-mdr
        {
            font-weight:           400;
        }

        body .gist .pl-mi, body .gist .pl-pdi
        {
            color:                 #ffe5bb;
            font-style:            italic;
        }

        body .gist .pl-sra,
        body .gist .pl-src,
        body .gist .pl-sre
        {
            color:                 #cc3;
        }

        body .gist .pl-mdht, body .gist .pl-mi1
        {
            color:                 #a5c261;
            background:            #121315;
        }

        body .gist .pl-md, body .gist .pl-mdhf
        {
            color:                 #b83426;
            background:            #121315;
        }

        body .gist .pl-ib, body .gist .pl-id,
        body .gist .pl-ii, body .gist .pl-iu
        {
            background:            #121315;
        }

        body .gist .pl-ms1
        {
            background:            #121315;
        }

        body .gist .highlight-text-html-basic .pl-ent,
        body .gist .pl-cce, body .gist .pl-cn, body .gist .pl-coc, body .gist .pl-enc,
        body .gist .pl-ens, body .gist .pl-k, body .gist .pl-kos, body .gist .pl-kou,
        body .gist .pl-mh .pl-pdh, body .gist .pl-mp, body .gist .pl-mp .pl-s3,
        body .gist .pl-mp1 .pl-sf, body .gist .pl-mq, body .gist .pl-mri,
        body .gist .pl-pde, body .gist .pl-pse, body .gist .pl-pse .pl-s2,
        body .gist .pl-s, body .gist .pl-st, body .gist .pl-stp, body .gist .pl-sv,
        body .gist .pl-v, body .gist .pl-va, body .gist .pl-vi, body .gist .pl-vpf,
        body .gist .pl-vpu, body .gist .pl-mdr
        {
                color: #cc7833;
        }

        body .gist .pl-cos, body .gist .pl-ml, body .gist .pl-pds,
        body .gist .pl-s1, body .gist .pl-sol, body .gist .pl-mb,
        body .gist .pl-pdb
        {
                color: #a5c261;
        }

        body .gist .pl-e, body .gist .pl-en, body .gist .pl-entl,
        body .gist .pl-mo, body .gist .pl-sc, body .gist .pl-sf,
        body .gist .pl-smi, body .gist .pl-smp, body .gist .pl-mdh,
        body .gist .pl-mdi
        {
                color: #ffc66d;
        }

        body .gist .pl-ef, body .gist .pl-enf, body .gist .pl-enm, body .gist .pl-entc,
        body .gist .pl-entm, body .gist .pl-eoac, body .gist .pl-eoac .pl-pde, body .gist .pl-eoi,
        body .gist .pl-mai .pl-sf, body .gist .pl-mm, body .gist .pl-pdv, body .gist .pl-smc,
        body .gist .pl-som, body .gist .pl-sr, body .gist .pl-enti
        {
                color: #b83426;
        }
        `
    }

    /*
        Throw Error
    */

    private async ThrowError( el: HTMLElement, gistInfo: string, err = '' )
    {
        const div_Error = el.createEl( 'div',   { text: '', cls: 'gistr-container-error' } )
        div_Error.createEl( 'div',              { text: lng( 'err_gist_loading_fail_name' ), cls: 'gistr-load-error-l1' } )
        div_Error.createEl( 'div',              { text: gistInfo, cls: 'gistr-load-error-l2' } )
        div_Error.createEl( 'small',            { text: lng( 'err_gist_loading_fail_resp', err ) } )
    }

    /*
        Get Javascript
    */

    private async GetJavascript( el: HTMLElement, data: string, url: string )
    {
        const reqUrlParams: RequestUrlParam = { url: url, method: 'GET', headers: { Accept: 'text/javascript' } }
        try { return await request( reqUrlParams ) }
        catch ( err )
        {
            return this.ThrowError( el, data, lng( 'err_gist_loading_fail_detail', err ) )
        }
    }

    /*
        Get CSS
    */

    private async GetCSS( el: HTMLElement, data: string, url: string )
    {
        const reqUrlParams: RequestUrlParam = { url : url, method: 'GET', headers: { Accept: 'text/css' } }
        try { return await request( reqUrlParams ) }
        catch ( err )
        {
            return this.ThrowError( el, data, lng( 'err_gist_loading_fail_detail', err ) )
        }
    }

    /*
        Collect message data from JS_EventListener
    */

    messageEventHandler = ( evn: MessageEvent ) =>
    {
        if ( evn.origin !== 'null' ) return
        if ( evn.data.sender !== sender ) return

        const uuid                          = evn.data.gid
        const scrollHeight                  = evn.data.scrollHeight

        const gist_Container: HTMLElement   = document.querySelector( 'iframe#' + uuid )

        gist_Container.setAttribute( 'height', scrollHeight )
    }

    /*
        Event processor
    */

    processor = async ( src: string, el: HTMLElement ) =>
    {
        return this.GistHandle(  this.plugin, el, src )
    }
}
