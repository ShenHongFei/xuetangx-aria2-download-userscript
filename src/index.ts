// ==UserScript==
// @name         学堂在线 课程视频及字幕 aria2下载脚本
// @namespace    https://github.com/ShenHongFei/
// @version      2017.8.27.19.10
// @description  1.提取视频和字幕的链接<br>2.按照上下文自动生成文件名<br>3.点击按钮通过 JOSN-RPC 调用 aria2 下载至指定文件夹
// @author       沈鸿飞
// @homepageURL  
// @updateURL    
// @match        http://www.xuetangx.com/courses/**
// @match        https://www.xuetangx.com/courses/**
// @icon         https://github.com/ShenHongFei/xuetangx-aria2-download-userscript/favicon.png
// @license      MIT License
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @_require      file://E:\SDK\xuetangx-aria2-download-userscript\index.js
// ==/UserScript==
class Aria2Config{
    uri:string
    token:string
    storage_directory:string
}

const default_aria2_config:Aria2Config={
    uri:'http://localhost:6800/jsonrpc',
    token:'',
    storage_directory:'D:\\\\'
}
declare function GM_getValue(name:string,defaultValue:any):any
declare function GM_setValue(name:string,value:any):any

let counter=0
const id=setInterval(()=>{
    try{
        const unit=$('.active.ui-accordion-header')[0].textContent.trim().replace(' ',' ')
        const section=$('#accordion li.active p:first')[0].firstChild.textContent.trim().replace(' ',' ')
        const videos=<string[]><any>$('.xt_video_player').map((i,x)=>x.getAttribute('src')).get()
        const transcripts=<string[]><any>$('a[href$="transcript/download"]').map((i,x)=>'http://www.xuetangx.com'+x.getAttribute('href')).get()
        
        counter++
        //loop and wait for the next turn
        if(videos.length<transcripts.length&&counter<10) return
        //time out ,give up
        if(videos.length<transcripts.length&&counter==10){
            clearInterval(id)
            console.error('视频地址加载失败')
        }
        clearInterval(id)
        console.log(`video ready, clear Interval\nvideos:${videos.length}\ntranscripts:${transcripts.length}`)
        console.log(videos)
        console.log(transcripts)
        //get_section_index
        const current_chapter=$('.chapter.is-open')
        const current_section=current_chapter.find('li.active')
        const section_index:string=($('.chapter').index(current_chapter)+1)+'.'+(current_section.parent().children().index(current_section)+1)
        
        const video_title_node=$('#seq_content > div > div > div.vert.vert-0 > div > h2')
        
        //aria2 config settings
        let aria2_config:Aria2Config=GM_getValue('aria2_config',default_aria2_config)
        console.log('current saved aria2_config:')
        console.log(aria2_config)
        $(`
            <div>
                <button id="configure_aria2_button" style="margin-bottom: 20px;">配置 aria2</button>
                <div id="configure_aria2_panel" style="display: none;margin: 0.5em;">
                    uri: <input id="aria2_uri" value="${aria2_config.uri}"><br>
                    token: <input id="aria2_token" value="${aria2_config.token}"><br>
                    storage_directory: <input id="aria2_storage_directory" value="${aria2_config.storage_directory}"><br>
                    <button id="save_aria2_settings_button" style="margin-bottom: 20px;">保存</button>
                </div>
            </div>
        `.replace(/ {4,}/g,'')
        ).insertBefore(video_title_node)
        const configure_button=$('#configure_aria2_button')
        const configure_panel=$('#configure_aria2_panel')
        configure_button.on('click',()=>{
            configure_panel.show()
            configure_button.css('color','black')
        })
        $('#save_aria2_settings_button').on('click',()=>{
            aria2_config={
                uri:$('#aria2_uri').val().toString(),
                token:$('#aria2_token').val().toString(),
                storage_directory:$('#aria2_storage_directory').val().toString()
            }
            GM_setValue('aria2_config',aria2_config)
            configure_button.css('color','green')
            configure_panel.hide()
            console.log('new aria2_config saved')
            console.log(aria2_config)
        })
        //build download buttons and actions
        videos.forEach((x,i)=>{
            draw_buttons_and_links(x,get_file_name('mp4',videos.length>1?(i+1):null))
        })
        transcripts.forEach((x,i)=>{
            draw_buttons_and_links(x,get_file_name('srt',transcripts.length>1?(i+1):null))
        })
        
        function get_file_name(suffix:string,index?:number){
            return `${section_index} ${unit} ${section}${index?' '+index:''}.${suffix}`
        }
        function draw_buttons_and_links(uri:string,file_name:string):void{
            $(`
                <div style="margin-top: 15px;margin-bottom: 15px;">
                    <p style="margin-bottom: 0.3em;">${file_name}</p>
                    <button style="margin-top: 10px;display: inline-block;">ARIA2 RPC</button>
                    <a href="${uri}" style="margin-top: 10px;display: inline-block;line-height: 55px;padding-left: 30px;" download="${file_name}">下载链接</a>
                </div>
            `.replace(/ {4,}/g,''))
            .on('click','button',(event)=>{
                let success_button=event.target
                console.log('success_button')
                send_aria2_download_rpc(
                    uri,
                    file_name,
                    GM_getValue('aria2_config',default_aria2_config),
                    (rpc_response)=>{
                        try{
                            console.log('rpc sent successfully, server reply:')
                            console.log(rpc_response)
                            if(rpc_response.result){
                                success_button.style.color='green'
                            }
                        }catch(any){console.error(rpc_response)}
                    },
                    (json_rpc_sent,jqXHR:JQueryXHR,textStatus:string,errorThrown:string)=>{
                        console.error('error in send_aria2_download_rpc')
                        console.log(aria2_config)
                        console.log(json_rpc_sent)
                        console.log(jqXHR)
                        alert('aria2 rpc 发送失败，请检查console日志')
                    })
            })
            .insertBefore(video_title_node)
        }
    }catch(any){
        console.log(any)
        clearInterval(id)
    }
},1000)

//send json-rpc(with cookie) to aria2
function send_aria2_download_rpc(
    uri:string,
    filename:string,
    aria2_config:Aria2Config,
    success_callback?:(rpc_response:any)=>void,
    error_callback?:(json_rpc_sent:object,jqXHR:JQueryXHR,textStatus:string,errorThrown:string)=>void
){
    const json_rpc={
        id:'',
        jsonrpc:'2.0',
        method:'aria2.addUri',
        params:[
            `token:${aria2_config.token}`,
            [uri],
            {
                dir:aria2_config.storage_directory,
                out:filename,
                header:['Cookie: '+document.cookie]
            }
        ]
    }
    $.ajax({
    url:aria2_config.uri,
    //method:'POST' can only be used after jQuery 2.0
    type:'POST',
    crossDomain:true,
    processData:false,
    data:JSON.stringify(json_rpc),
    contentType:'application/json',
    success:success_callback,
    error:(jqXHR:JQueryXHR,textStatus:string,errorThrown:string)=>{
        error_callback(json_rpc,jqXHR,textStatus,errorThrown)
    },
})
}