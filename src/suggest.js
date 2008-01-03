/**
 * freebaseSuggest() provides a way to attach Freebase suggestion behavior to a
 * text input using the Freebase.com autocomplete service.
 * 
 * freebaseSuggest accepts a single argument which is an options Object with
 * the following attributes:
 *
 * width:       This is the width of the suggestion list and the flyout in
 *              pixels. Default is 275.
 * 
 * soft:        Soft suggestion. If true, DO NOT auto-select first item
 *              in the suggestion list. Otherwise, select first item. 
 *              Default is false.
 * 
 * suggest_new:  To enable a suggest new option, set text to a non-null string.
 *              This is the string displayed for the suggest new option
 *              (eg, "Create new topic"). Default is null.
 * 
 * flyout:      To enable flyout to show additional information for the 
 *              currently highlighted item including a thumbnail and blurb.
 *              Default is true.
 * 
 * service_url: This the base url to all the api services like autocomplete,
 *              blurbs and thumbnails. Default is "http://www.freebase.com".
 * 
 * ac_path:     The path to the autcomplete service. Default is "/api/service/search".
 * 
 * ac_param:    A dicionary of query parameters to the autocomplete service. 
 *              Currently, the supported parameters are 
 *              query (required) - the string to do an auto-complete on. See ac_qstr
 *              type  (optional) - type of items to match for (ie, "/film/film")
 *              limit (optional) - the maximum number of results to return, default is 20
 *              start (optional) - offset from which to start returning results, default is 0
 * 
 * ac_qstr:     This is the parameter name to be passed to the autocomplete
 *              service for the string to autocomplete on. The value will
 *              be what the user typed in the input. Default is "query".
 * 
 * blurb_path:  The path to the blurb service for the description to be shown
 *              in the flyout. Default is "/api/trans/blurb".
 * 
 * blurb_param: The query parameters to the blurb service.
 *              Default is { maxlength: 300 }.
 * 
 * thumbnail_path:  The path to the thumbnail service to be shown in the flyout. 
 *                  Default is "/api/trans/image_thumb".
 * 
 * thumbnail_param: The query paramters to the thumbnail service. Default is {}.
 * 
 * filter:      Specify a filter function if you want to filter any of the items
 *              returned by ac_path service. The function is called with one
 *              arugment representing an item from the ac_path result. The function
 *              should return TRUE to include the item or FALSE to exclude. 
 *              Default is a function that returns TRUE.
 * 
 * transform:   Specify a transform function if you want to transform the default
 *              display of the suggest list item.
 *              
 * 
 * In addition, freebaseSuggest will trigger the following events on behalf of
 * the input it's attached to. They include:
 * 
 * fb-select:       Triggered when something is selected from the suggestion
 *                  list. The data object will contain id and name fields:
 *                  { id: aString, name: aString }.
 * 
 * fb-select-new:   Triggered when the suggest_new option is selected. 
 *                  The data object will only contain a name field: { name: aString }.
 * 
 *
 * @example
 * $('#myInput')
 *      .freebaseSuggest()
 *      .bind('fb-select', function(e, data) { console.log('suggest: ', data.id); })
 * 
 * @desc Attach Freebase suggestion behavior to #myInput with default options and on
 *          'suggest', output the selected id the console.
 *
 *
 * @example
 * var options = {
 *      soft: true,
 *      suggest_new: 'Create new Film',
 *      ac_param: {
 *          type: '/film/film',
 *          category: 'instance',
 *          get_all_types: '0',
 *          disamb: '1',
 *          limit: '10'
 *      }
 * };
 * $('#myInput')
 *      .freebaseSuggest(options)
 *      .bind('fb-select', function(e, data) { console.log('suggest: ', data.id); })
 *      .bind('fb-select-new', function(e, data) { console.log('suggest new: ', data.name); });
 * 
 * @desc Soft suggestion on instances of '/film/film' with a suggest new option and
 *          output the various events to the console.
 *
 * @name   freebaseSuggest
 * @param  options  object literal containing options which control the suggestion behavior
 * @return jQuery
 * @cat    Plugins/Freebase
 * @type   jQuery
 */
$.fn.freebaseSuggest = function(options) {
    return $(this)._freebaseInput(fb.suggest.getInstance(), options);
};

/**
 * SuggestControl class
 * superClass: InputSelectControl
 */
function SuggestControl() { 
    fb.InputSelectControl.call(this);
    this.default_options = {
        width: 275,   // width of list and flyout
        soft: false,  // if true, DO NOT auto-select first item, otherwise select first item by default
        suggest_new: null, // to show suggest new option, set text to something (eg, "Create new topic")
        flyout: true,  // show flyout on the side of highlighted item
        service_url: "http://www.freebase.com",
        ac_path: "/api/service/search",
        ac_param: {
            type: "/common/topic",
            start: 0,
            limit: 20
        },
        ac_qstr: "query",  // this will be added to the ac_param ...&prefix=str
        blurb_path: "/api/trans/blurb",
        blurb_param: {
            maxlength: 300
        },
        thumbnail_path: "/api/trans/image_thumb",
        thumbnail_param: {},
        filter: null,
        transform: null
    }; 
};
// inheritance: prototype/constructor chaining
SuggestControl.prototype = new fb.InputSelectControl();
SuggestControl.prototype.constructor = SuggestControl;

SuggestControl.instance = null;
SuggestControl.getInstance = function() {
    if (!SuggestControl.instance)
        SuggestControl.instance = new SuggestControl();
    return SuggestControl.instance;
};

// shorthand for SuggestControl.prototype
var p = SuggestControl.prototype;

p.list_load = function(input) {//fb.log("list_load", input);
    if (!input) 
        return;
    if (!"fb_id" in input) 
        return;
    var txt = this.val(input);
    if (!txt.length) 
        return;  
    if (!this.cache[input.fb_id]) 
        this.cache[input.fb_id] = {};
    if (txt in this.cache[input.fb_id]) {
        //fb.log("load from cache: ", txt);
        window.clearTimeout(this.handle_timeout);
        this.handle_timeout = window.setTimeout(this.delegate("handle", [{id:"LIST_RESULT", input:input, result:this.cache[input.fb_id][txt]}]), 0);
        return;
    }    
    var options = this.options(input);
    var txt = this.val(input);
    var param = options.ac_param;
    //TODO: remove star and change ac_qstr when search gets the same params as autocomplete
    param[options.ac_qstr] = txt + '*'; // the search api needs a '*' to perform auto-complete rather than search.
    $.ajax({
        type: "GET",
		url: options.service_url + options.ac_path,
		data: param,
		success: this.delegate("list_receive", [input, txt]),
		dataType: use_jsonp(options) ? "jsonp": "json",
		cache: true
	});
};

p.list_receive_hook = function(input, txt, result) {
    // update cache
    if (!this.cache[input.fb_id])
        this.cache[input.fb_id] = {};
    this.cache[input.fb_id][txt] = result;
};

/**
 * add select new option below the select list
 * and attach mouseover, mouseout, and click handlers
 */
p.list_show_hook = function(list, input, options) {    
    if (!$(list).next(".fbs-selectnew").length)
        $(list).after('<div style="display:none;" class="fbs-selectnew"></div>');
    var suggest_new = $(list).next(".fbs-selectnew")[0];
    if (options.suggest_new) {
        var owner = this;
        $(suggest_new)
            .unbind()
            .empty()
            .append(options.suggest_new)
            .show()
            .mouseover(function(e) {
                $(e.target).addClass("fbs-selectnew-selected");
                owner.list_select(null);
                owner.flyout_hide();   
            })
            .mouseout(function(e) {
                $(this).removeClass("fbs-selectnew-selected");
            })
            .click(function(e) {
                $(input).trigger("fb-select-new", [{name:owner.val(input)}])
                    .trigger("suggest-new", [{name:owner.val(input)}]); // legacy - for compatibility
                owner.list_hide();
                owner.transition("start");
            });
    }
    else
        $(suggest_new).unbind().hide();
};

p.list_hide_hook = function() {
    this.flyout_hide();
};

p.list_select_hook = function(sli, options) {
    this.flyout_hide();
    if (sli && options && options.flyout && sli.fb_data && sli.fb_data.id != "NO_MATCHES")
        this.flyout(sli, options);  
};

p.transform = function(data, txt) {
    var owner = this;
    var types = [];
    if (data.type)
        $.each(data.type, function(i,n){
            if (n.id != '/common/topic')
                types.push(owner.name(n));
        });
    types = types.join(", ");

    var domains = [];
    if (data.domain)
        $.each(data.domain, function(i,n){
            domains.push(owner.name(n));
        });
    domains = domains.join(", ");

    var aliases = [];
    if (data.alias)
        $.each(data.alias, function(i,n){
            aliases.push(n);
        });
    aliases = aliases.join(", ");

    var props = [];
    if (data.properties)
        $.each(data.properties, function(i,n){
            props.push(n);
        });
    props = props.join(", ");
    
    var div = document.createElement("div");
    $(div).append(
            '<div class="fbs-li-aliases"></div>' +
            '<div class="fbs-li-name"></div>' +
            '<div class="fbs-li-types"></div>' +
            '<div class="fbs-li-domains"></div>' +
            '<div class="fbs-li-props"></div>');
    if (aliases.length) {
        var text = $(".fbs-li-aliases", div).append(document.createTextNode("("+aliases+")")).text();
        if (txt) 
            $(".fbs-li-aliases", div).empty().append(this.em_text(text, txt));
    }
    else
        $(".fbs-li-aliases", div).remove();
     
    var text = $(".fbs-li-name", div).append(document.createTextNode(this.name(data))).text();
    if (txt) 
        $(".fbs-li-name", div).empty().append(this.em_text(text, txt));

    if (types.length)
        $(".fbs-li-types", div).append(document.createTextNode(types));
    else
        $(".fbs-li-types", div).remove();

    if (domains.length)
        $(".fbs-li-domains", div).append(document.createTextNode(domains));
    else
        $(".fbs-li-domains", div).remove();        
          
    if (props.length)
        $(".fbs-li-props", div).append(document.createTextNode(props));
    else
        $(".fbs-li-props", div).remove();
    
    return div.innerHTML;    
};

p.flyout = function(li, options) { //fb.log("flyout", li);
    this.flyout_hide();
    this.flyout_callback = this.flyout_resources(li, options);     
};

/**
 * load flyout resources (thumbnail, blurb), don't show until
 * both thumbnail and blurb have been loaded.
 */
p.flyout_resources = function(li, options) {//fb.log("flyout_resources", li);
    if (!(li && li.fb_data && "id" in li.fb_data && "article" in li.fb_data && "image" in li.fb_data))
        return;
    var owner = this;
    var cb = function(data_type, data) {//fb.log("callback", data_type, data);    
        // data_type: "image", "blurb", "disable"
        arguments.callee[data_type] = data;        
        if (arguments.callee.disable)
            return;
        if (arguments.callee.image && arguments.callee.blurb) {
            owner.flyout_show(li, options, arguments.callee.image, arguments.callee.blurb);
            arguments.callee.image = null;
            arguments.callee.blurb = null;
        }
    };    
    // load article
    if (li.fb_data.article)
        this.blurb_load(typeof li.fb_data.article == "object" ?  li.fb_data.article.id : li.fb_data.article, options, cb);
    else
        cb.apply(null, ["blurb", "&nbsp;"]);
    
    // load image
    if (li.fb_data.image)        
        this.image_load(typeof li.fb_data.image == "object"? li.fb_data.image.id : li.fb_data.image, options, cb);
    else
        cb.apply(null, ["image", "#"]);

    return cb;
};


p.flyout_hide = function() {//fb.log("flyout_hide");
    if (this.flyout_callback)
        this.flyout_callback("disable", true);
    $("#fbs_flyout").hide();
};

p.flyout_show = function(li, options, img_src, blurb) {//fb.log("flyout_show", li, img_src, blurb);
    if ("none" == $("#fbs_list").css("display")) 
        return;
    var s = this.list_selection().item;
    if (!(li == s && li.fb_data.id == s.fb_data.id))
        return;

    if (!$("#fbs_flyout").length) {
        $(document.body)
            .append(
                '<div style="display:none;position:absolute" id="fbs_flyout" class="fbs-topshadow">' +
                    '<div class="fbs-bottomshadow">'+
                        '<div class="fbs-flyout-container">' +
                            // label
                            '<div class="fbs-flyout-name"></div>' +
                            // image
                            '<div class="fbs-flyout-image"></div>' +
                            // types
                            '<div class="fbs-flyout-types"></div>' +
                            // domains
                            '<div class="fbs-flyout-domains"></div>' +
                            // blurb
                            '<div class="fbs-flyout-blurb"></div>' +
                        '</div>' +                                              
                    '</div>' +
                '</div>');   
    }
    
    $("#fbs_flyout .fbs-flyout-name").empty().append('<a href="' + this.freebase_url(li.fb_data.id, options) + '">' + $(".fbs-li-name", li).text() + '</a>');
    $("#fbs_flyout .fbs-flyout-image").empty();
    if (img_src != "#")
        $("#fbs_flyout .fbs-flyout-image").append('<img src="' + img_src + '"/>');
    $("#fbs_flyout .fbs-flyout-types").empty().append($(".fbs-li-types", li).text());
    $("#fbs_flyout .fbs-flyout-domains").empty().append($(".fbs-li-domains", li).text());
    $("#fbs_flyout .fbs-flyout-blurb").empty().append(blurb);

    var pos = $("#fbs_list > .fbs-bottomshadow > .fbs-ul").offset();
    var left = pos.left + options.width;
    var sl = document.body.scrollLeft;
    var ww = $(window).width();
    if ((left+options.width) > (sl+ww))
        left = pos.left - options.width;
    //var pos = $(li).offset();
    $("#fbs_flyout")
        .css({top:pos.top, left:left, width:options.width})
        .show();
    
};

p.blurb_receive = function(id, cb, o) {
    // depending on if this is a jsonp or null/raw dataType, o may be an
    // object or a string
	if (typeof o == "object") {
        // handle errors
        if (o.status !== '200 OK') {
            fb.error("SuggestControl.blurb_receive", o.code, o.messages, o);
            return;
        }

        // now get the string value
        o = o.result.body;
    }

    // update cache
    this.cache[id] = o;
    // handle result    
    cb.apply(null, ["blurb", o]);
};

p.blurb_load = function(id, options, cb) {
    // look in cache
    if (id in this.cache) {
        cb.apply(null, ["blurb", this.cache[id]]);
        return;
    }
    $.ajax({
        type: "GET",
		url: options.service_url + this.blurb_path(id, options),
		data: options.blurb_param,
		success: this.delegate("blurb_receive", [id,cb]),
		dataType: use_jsonp(options) ? "jsonp" : null,
		cache: true
	});
};

p.image_load = function(id, options, cb) {//fb.log("image_load", id, options, cb);
    // look in cache
    if (id in this.cache) {
        cb.apply(null, ["image", this.cache[id]]);
        return;
    }    
    var i = new Image();
    var src = this.thumbnail_url(id, options);    
    i.onload = fb.delegate(cb, null, ["image", src]);        
    i.onerror = fb.delegate(cb, null, ["image", src]);  
    fb.autoclean(i, fb.clean_image);
    this.cache[id] = src;   
    i.src = src; 
};


p.blurb_path = function(id, options) {
    return options.blurb_path + this.quote_id(id);    
};

p.thumbnail_url = function(id, options) {
    var url = options.service_url + options.thumbnail_path +
        this.quote_id(id);
    var qs = $.param(options.thumbnail_param);
    if (qs)
         url += "?" + qs;
    return url;
};

p.freebase_url = function(id, options) {
    var url = options.service_url + "/view" + this.quote_id(id);
    return url;
};

p.quote_id = function(id) {
    if (id.charAt(0) == '/')
        return id;
    else
        return ('/' + encodeURIComponent(id));
};

fb.suggest = SuggestControl;
