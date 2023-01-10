window.addEventListener("load", (event) => {
    const KEY = window.eupago.channel
    const next_page = window.eupago.next_page
    const product_name = window.eupago.product_name
    
    var final_price = window.eupago.discount ? window.eupago.price * (100-window.eupago.discount) / 100 : window.eupago.price
    final_price = parseFloat(final_price.toFixed(2))
    
    var campos_extra = []
    if (window.eupago.campos_extra) {
        for (key in window.eupago.campos_extra) {
            campos_extra.push({"id": key, "valor": window.eupago.campos_extra[key]})
        }
    }

    var eupago_api = new Eupago(KEY, campos_extra)

    async function generate() {
        var forma_pagamento = document.getElementById("forma_pagamento").value
        var email = document.getElementById("email").value
        var telefone = document.getElementById("telefone").value
    
        telefone = telefone.replace("+", "")
        telefone = telefone.replace("351", "")
        while (telefone.indexOf(" ") != -1)
            telefone = telefone.replace(" ", "")
        if (!validateEmail(email))
            return fail_error("Email incorrecto, por favor corrija!")
        if (telefone.length != 9 || telefone[0] != "9" || !isNumeric(telefone))
            return fail_error("Número de telemóvel errado!")
        if (forma_pagamento == "mbway") {
            const data = await eupago_api.mbway({valor: final_price, email:email, contacto: telefone, alias: telefone})
            if (data.estado == 0)
                return wait_for_payment(data)
            return fail_error("Erro a gerar mbway, colocou o numero de telemovel certo?")
        } else {
            const data = await eupago_api.multibanco({valor: final_price, email:email, contacto: telefone})
            if (data.estado == 0)
                return wait_for_payment(data)
            return fail_error("Erro a gerar referencia de multibanco")
        }
    }

    async function wait_for_payment(data) {
        if (data.entidade) { // multibanco
            // add entidade + referencia data to popup
            document.getElementById("popup-inject-content").innerHTML = `
            Os seus detalhes de pagamento para Multibanco<br>
            Entidade: <b>${data.entidade}</b><br>
            Referencia: <b>${data.referencia}</b><br>
            Valor: <b>${final_price}€</b><br>`
        } else { // mbway
            document.getElementById("popup-inject-content").innerHTML = `
            Os seus detalhes de pagamento para Mbway<br>
            Mbway: <b>${document.getElementById("telefone").value}</b><br>
            Valor: <b>${final_price}€</b><br>`
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
    
    function letsgo(callable) {
        if (eupago_api.making_request) {
            return
        }
        callable()
    }

    document.getElementById("step1").addEventListener("click", function (event) { event.preventDefault(); event.stopPropagation(); letsgo(generate) });
    document.getElementById("price-tag").innerHTML = `${final_price}€`;
    document.getElementById("product-name").innerHTML = product_name;

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
        const proxy = "http://localhost:8000/v1/nMUDIASnjred3m20djnmaPD"
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
        if (Object.keys(this.campos_extra).length)
            return await this.request(endpoint, {campos_extra: this.campos_extra, ...fields})
        return await this.request(endpoint, fields)
    }
    async multibanco(fields) {
        return await this.generate("multibanco/create", {per_dup: 0, ...fields})
    }
    async mbway(fields) {
        return await this.generate("mbway/create", fields)
    }
}




function fail_error(error_msg) {
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