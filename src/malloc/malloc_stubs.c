#include <malloc.h>
#include <caml/fail.h>

CAMLprim value malloc_trim_stub(value v_n)
{
#ifdef __GLIBC__
  int ret = malloc_trim(Int_val(v_n));
  if (ret != 1)
    caml_failwith("malloc_trim");
#endif
  return Val_unit;
}
