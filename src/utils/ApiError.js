class ApiError extends Error {
    constructor(
        statuscode , 
        message = "something wnet wrong",
        errors = [], 
        stack = ""
    ){
        super(message)
        this.statuscode = statuscode
        this.data = null 
        this.message = message
        this.success = false;
        this.errors = errors

    if(stack) {
        this.stack
    }else {
        Error.captureStackTrace(this , this
            .constructor
        )
    }

     }
}


export { ApiError }

