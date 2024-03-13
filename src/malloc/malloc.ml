external malloc_trim : int -> bool = "malloc_trim_stub"
(*
  DESCRIPTION
    The `malloc_trim` function attempts to release free memory from the heap (by calling sbrk(2) or madvise(2) with
    suitable arguments).

    The pad argument specifies the amount of free space to leave untrimmed at the top of the heap.  If this argument
    is 0, only the minimum amount of memory is maintained at the top of the heap (i.e., one page or less).
    A nonzero argument can be used to maintain some trailing space at the top of the heap in order to allow future
    allocations  to  be  made without having to extend the heap with sbrk(2).

  RETURN VALUE
    The `malloc_trim` function returns `true` if memory was actually released back to the system, or `false` if it was
    not possible to release any memory.
*)
