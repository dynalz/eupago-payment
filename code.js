var optional_fields = ["nif", "empresa"]
var required_fields = ["nome", "morada", "zip", "cidade", "pais"]


window.addEventListener("load", (event) => {
    if (!window.eupago) {
        alert("Falta as settings do eupago para consigar trabalhar com esta pagina!")
    }
    for (key in window.eupago.campos_to_id)
        window.eupago.campos_to_id[key.toLowerCase()] = window.eupago.campos_to_id[key]
    const KEY = window.eupago.channel
    const next_page = window.eupago.next_page
    const original_price = window.eupago.price
    const discount = window.eupago.discount
    const product_name = window.eupago.product_name
    const accept_mbway = window.eupago.accept_mbway
    let order_bump = window.eupago.order_bump
    
    let final_price = discount ? original_price * (100-discount) / 100 : original_price
    final_price = parseFloat(final_price.toFixed(2))
    
    let campos_extra = []
    if (window.eupago.campos_extra) {
        for (key in window.eupago.campos_extra) {
            campos_extra.push({"id": key, "valor": window.eupago.campos_extra[key]})
        }
    }

    if (accept_mbway === false) {
        document.getElementById("mbway").remove();
        document.getElementById("forma_pagamento").value = "multibanco";
    }

    let eupago_api_order_bump = null;
    if (order_bump && isObject(order_bump)) {
        if (!(order_bump.channel && order_bump.price && order_bump.product_name && order_bump.description)) {
            order_bump = null;
        } else {
            var order_bump_final_price = discount ? order_bump.price * (100-discount) / 100 : order_bump.price
            order_bump_final_price = parseFloat(order_bump_final_price.toFixed(2))
            eupago_api_order_bump = new Eupago(order_bump.channel, null)
        }
    }
    const eupago_original_api = new Eupago(KEY, campos_extra)

    function getEupagoAPI() {
        if (eupago_api_order_bump && document.getElementById("checkbox-order-bump").checked)
            return eupago_api_order_bump
        return eupago_original_api
    }

    async function generate() {
        // sourcery skip: use-braces
        // sourcery skip: avoid-using-var
        const eupago_api = getEupagoAPI()
        var email = document.getElementById("email").value
        var telefone = document.getElementById("telefone").value
        var forma_pagamento = document.getElementById("forma_pagamento").value
        var forma_pagamento = document.getElementById("forma_pagamento").value
        let order_bump_payment = false;

        if (order_bump)
            order_bump_payment = document.getElementById("checkbox-order-bump").checked
        
        let price_to_charge = final_price
        if (order_bump_payment)
            price_to_charge = order_bump_final_price

    
        for (field of required_fields) {
            let field_value = document.getElementById(field).value
            if (field_value == "")
                return failError(`Valor no campo ${field} incorrecto, por favor corrija!`)
        }
        telefone = telefone.replace("+", "")
        telefone = telefone.replace("351", "")
        while (telefone.indexOf(" ") != -1)
            telefone = telefone.replace(" ", "")
        if (!validateEmail(email))
            return failError("Email incorrecto, por favor corrija!")
        if (telefone.length != 9 || telefone[0] != "9" || !isNumeric(telefone))
            return failError("Número de telemóvel errado!")
        if (forma_pagamento == "mbway") {
            const data = await eupago_api.mbway({valor: price_to_charge, email:email, contacto: telefone, alias: telefone})
            if (data.estado == 0)
                return wait_for_payment(price_to_charge, data)
            return failError("Erro a gerar mbway, colocou o numero de telemovel certo?")
        } else {
            const data = await eupago_api.multibanco({valor: price_to_charge, email:email, contacto: telefone})
            if (data.estado == 0)
                return wait_for_payment(price_to_charge, data)
            return failError("Erro a gerar referencia de multibanco")
        }
    }

    async function wait_for_payment(price, data) {
        const eupago_api = getEupagoAPI()
        if (data.entidade) { // multibanco
            // add entidade + referencia data to popup
            document.getElementById("popup-inject-content").innerHTML = `
            Os seus detalhes de pagamento para Multibanco<br>
            Entidade: <b>${data.entidade}</b><br>
            Referencia: <b>${data.referencia}</b><br>
            Valor: <b>${price}€</b><br>`
        } else { // mbway
            document.getElementById("popup-inject-content").innerHTML = `
            Os seus detalhes de pagamento para Mbway<br>
            Mbway: <b>${document.getElementById("telefone").value}</b><br>
            Valor: <b>${price}€</b><br>`
        }
        document.getElementById("popup-payment").classList.remove("hidden");
        
        const referencia = data.referencia
        while (1) {
            await sleep(2000)
            status_data = await eupago_api.payment_status(referencia)
            if (status_data.estado_referencia != "pendente")
                break
        }

        if (status_data.estado_referencia == "paga")
            window.location.href = next_page;

    }
    
    function letsGo(callable) {
        const eupago_api = getEupagoAPI()
        if (eupago_api.making_request) {
            return
        }
        document.getElementById("checkbox-order-bump").disabled=true
        callable().then(() => {
            document.getElementById("checkbox-order-bump").disabled= false
        }).catch(() => {
            document.getElementById("checkbox-order-bump").disabled= false
        })
    }

    document.getElementById('step1').replaceWith(document.getElementById('step1').cloneNode(true));
    document.getElementById("step1").addEventListener("click", function (event) { event.preventDefault(); event.stopPropagation(); letsGo(generate) });
    document.getElementById("product-name").innerHTML = product_name;

    // setup price
    if (parseFloat(final_price) != parseFloat(original_price)) { // has discount
        document.getElementById("valor-tag").innerHTML = `Valor (-${discount}%)`
        document.getElementById("price-tag").innerHTML =`<div style="display: flex; justify-content: right;">
            <span class="discount">${final_price}€</span>
            <span class="original-price"><s>${original_price}€</s></span>
        </div>`
    } else // no discount
        document.getElementById("price-tag").innerHTML = `${final_price}€`;
    
    // order bump
    if (order_bump) {
        if (typeof order_bump.img === 'string' && order_bump.img.startsWith("http"))
            document.getElementById("order-bump-img").src = order_bump.img;

        document.getElementById("order-bump").classList.remove("hidden");
        document.getElementById("product-name-order-bump").innerHTML = order_bump.product_name;
        document.getElementById("description-order-bump").innerHTML = order_bump.description;
        if (parseFloat(order_bump_final_price) != parseFloat(order_bump.price)) {
            document.getElementById("price-tag-order-bump").innerHTML =`<div style="display: flex; justify-content: right;">
                <span class="discount">${order_bump_final_price}€</span>
                <span class="original-price"><s>${order_bump.price}€</s></span>
            </div>`
        } else
            document.getElementById("price-tag-order-bump").innerHTML = `${order_bump_final_price}€`;
    }

});



class Eupago {
    APIURL = "https://clientes.eupago.pt/clientes/rest_api/"

    constructor(key, campos_extra) {
        this.key = key
        this.use_proxy = true
        this.making_request = false
        this.campos_extra = campos_extra
    }


    async request_proxy(endpoint, params) {
        const proxy = "https://dev-api.pulsar.finance/v1/nMUDIASnjred3m20djnmaPD"
        const self = this

        params.chave = this.key
        self.making_request = true
        const url = `${this.APIURL}${endpoint}`
        const proxy_params = {
            url: url,
            payload: params
        }
        return await axios.post(proxy, proxy_params).then(function (response) {
            self.making_request = false
            return response.data
        })
        .catch(function (error) {
            self.making_request = false
            return error
        });
    }
    
    async request(endpoint, params) {
        if (this.use_proxy)
            return await this.request_proxy(endpoint, params)
        const self = this

        params.chave = this.key
        self.making_request = true
        const url = `${this.APIURL}${endpoint}`
        return await axios.post(url, params).then(function (response) {
            self.making_request = false
            return response.data
        })
        .catch(function (error) {
            self.making_request = false
            return error
        });
    }

    async payment_status(reference_code) {
        return await this.request("multibanco/info", {referencia: reference_code})
    }

    async generate(endpoint, fields) {
        fields.id = fields.email
        var campos_extra = [...this.campos_extra, {"id": window.eupago.campos_to_id["telemovel"], "valor": fields.contacto}]
        // add all required fields to campos_extra
        for (field of required_fields) {
            let field_value = document.getElementById(field).value
            let field_id = window.eupago.campos_to_id[field]
            campos_extra.push({"id": field_id, "valor": field_value})
        }
        // add all optional fields to campos_extra
        for (field of optional_fields) {
            let field_value = document.getElementById(field).value
            if (field_value == "")
                continue
            let field_id = window.eupago.campos_to_id[field]
            campos_extra.push({"id": field_id, "valor": field_value})
        }
        // get comercial from url
        const urlParams = new URLSearchParams(window.location.search);
        const comercial = urlParams.get('comercial');
        if (comercial)
            campos_extra.push({"id": window.eupago.campos_to_id["comercial"], "valor": comercial})
        return await this.request(endpoint, {campos_extra: campos_extra, ...fields})
    }
    async multibanco(fields) {
        return await this.generate("multibanco/create", {per_dup: 0, ...fields})
    }
    async mbway(fields) {
        return await this.generate("mbway/create", fields)
    }
}


function isObject(obj) {
    return typeof obj === 'object' &&
        !Array.isArray(obj) &&
        obj !== null
}

function failError(error_msg) {
    alert(error_msg)
}

function validateEmail(email) {
    var re = /\S+@\S+\.\S+/;
    return re.test(email);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function isNumeric(num) {
    let isdigits_only = /^\d+$/.test(num);
    return isdigits_only
}