module Cors = struct
  let middleware inner_handler request =
    let allow_origin =
      match Dream.header request "Origin" with
      | Some o -> o
      | None -> "*"
    in
    let%lwt response = inner_handler request in
    Dream.set_header response "Vary" "Origin";
    Dream.set_header response "Access-Control-Allow-Credentials" "true";
    Dream.set_header response "Access-Control-Allow-Origin" allow_origin;
    Dream.set_header
      response
      "Access-Control-Allow-Headers"
      "accept, accept-encoding, authorization, content-type, dnt, origin, user-agent, x-csrftoken, x-requested-with";
    Dream.set_header response "Access-Control-Allow-Methods" "DELETE, GET, OPTIONS, PATCH, POST, PUT";
    Dream.set_header response "Access-Control-Max-Age" "86400";
    Lwt.return response
end

module Json_debug = struct
  open Dream

  let middleware ?log inner_handler request =
    let content_type = Dream.header request "Content-Type" in
    match content_type with
    | Some "application/json" ->
      let%lwt body = Dream.body request in
      let body =
        body
        |> Yojson.Basic.from_string
        |> Yojson.Basic.pretty_to_string
        |> Str.global_replace (Str.regexp_string "\\n") "\n"
        |> Str.global_replace (Str.regexp "^") (String.make 6 ' ')
      in
      let () =
        match log with
        | Some log -> log.debug (fun l -> l "JSON request: \n%s" body)
        | None -> ()
      in
      let%lwt response = inner_handler request in
      let%lwt resp_body = Dream.body response in
      let resp_body =
        resp_body
        |> Yojson.Basic.from_string
        |> Yojson.Basic.pretty_to_string
        |> Str.global_replace (Str.regexp_string "\\n") "\n"
        |> Str.global_replace (Str.regexp "^") (String.make 6 ' ')
      in
      let () =
        match log with
        | Some log -> log.debug (fun l -> l "JSON response: \n%s" resp_body)
        | None -> ()
      in
      Lwt.return response
    | Some _ | None -> inner_handler request
end

module No_trailing_slash = struct
  let middleware inner_handler request =
    let target = Dream.target request in
    match target with
    | "/" -> inner_handler request
    | _ ->
      if Base.String.is_suffix ~suffix:"/" target
      then Dream.redirect request (String.sub target 0 (String.length target - 1))
      else inner_handler request
end
