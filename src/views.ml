open Tyxml
open Html

let%html risposta_si ep_num giorni_fa titolo =
  {|
    <p id="for-prerender">
      <span>Sì!</span>
      <br />
      È uscito |}
    [txt giorni_fa]
    {| l'episodio
      <br /> |}
    [ep_num]
    {| <br />
      di Joypad, dal titolo
      <br />
      &#171;|}
    [txt titolo]
    {|&#187;
    </p>
  |}

let%html risposta_no giorni_fa data_italiano msg_risposta_no =
  {| <p id="for-prerender">
       <span>No. L'ultimo episodio è uscito |}
    [txt giorni_fa]
    {|, |}
    [txt data_italiano]
    {|. |}
    [
      txt
        (match msg_risposta_no with
        | Some m -> m
        | None -> "");
    ]
    {|</span></p> |}

let replace_txt p selector new_text =
  let open Soup in
  let s = p $ selector in
  let text_node = children s |> R.first in
  replace text_node (create_text new_text)

let react_build_index_s_cache = ref None

let index uscito giorni_fa data_italiano ep_num titolo msg_risposta_no : string =
  let open Soup in
  let react_build_index_s =
    match !react_build_index_s_cache with
    | Some s -> s
    | None -> begin
      let react_build_index_s = Static_filesystem.read "index.html" |> Utils.option_value |> parse in
      let prerendered_index_s = Static_filesystem.read "prerendered_index.html" |> Utils.option_value |> parse in
      replace (react_build_index_s $ "main#root") (prerendered_index_s $ "main#root");
      delete (react_build_index_s $ "div#episode-section");
      react_build_index_s_cache := Some react_build_index_s;
      react_build_index_s
    end
  in

  let ep_num =
    match ep_num with
    | Joypad_monitor.Intero i -> begin span [txt ("numero " ^ string_of_int i)] end
    | Stringa s -> span [txt s]
    | NonSpecificato -> span []
  in

  let message_p_ty =
    if uscito then risposta_si ep_num giorni_fa titolo else risposta_no giorni_fa data_italiano msg_risposta_no
  in
  let message_p_str = Format.asprintf "%a" (pp_elt ()) message_p_ty in
  replace (react_build_index_s $ "p#for-prerender") (message_p_str |> parse);
  to_string react_build_index_s
