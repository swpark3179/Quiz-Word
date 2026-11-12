package com.swpark3179.quizword.lexicon

import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.provider.OpenableColumns
import java.io.File
import java.io.FileNotFoundException

/**
 * 단어장 앱의 등록 단어 목록을 다른 앱(문제은행)에 읽기 전용으로 내보낸다.
 *
 * content://<패키지>.lexicon/lexicon.json → 앱 문서 폴더(filesDir)의 shared/lexicon.json
 * 파일은 JS 쪽 src/lib/sharedLexicon.ts 가 앱이 켜질 때 쓴다. 표제어·한 줄 뜻·품사·발음·변화형만 들어 있고
 * 진행 기록 같은 개인 데이터는 없어서 권한 없이 공개한다 (두 앱의 서명 키가 달라도 읽을 수 있게).
 * 이 파일 하나 말고는 아무것도 열지 않고, 쓰기·지우기는 받지 않는다.
 */
class LexiconProvider : ContentProvider() {
  override fun onCreate(): Boolean = true

  private fun isLexicon(uri: Uri): Boolean = uri.pathSegments == listOf(FILE_NAME)

  private fun lexiconFile(uri: Uri): File {
    if (!isLexicon(uri)) throw FileNotFoundException(uri.toString())
    val ctx = context ?: throw FileNotFoundException(uri.toString())
    val file = File(File(ctx.filesDir, DIR_NAME), FILE_NAME)
    if (!file.isFile) throw FileNotFoundException(uri.toString())
    return file
  }

  override fun openFile(uri: Uri, mode: String): ParcelFileDescriptor {
    if (mode != "r") throw SecurityException("읽기 전용입니다: $mode")
    return ParcelFileDescriptor.open(lexiconFile(uri), ParcelFileDescriptor.MODE_READ_ONLY)
  }

  override fun getType(uri: Uri): String? = if (isLexicon(uri)) MIME_TYPE else null

  /** 파일 이름·크기 (OpenableColumns) — 파일이 아직 없으면 null */
  override fun query(
    uri: Uri,
    projection: Array<out String>?,
    selection: String?,
    selectionArgs: Array<out String>?,
    sortOrder: String?,
  ): Cursor? {
    val file = try {
      lexiconFile(uri)
    } catch (e: FileNotFoundException) {
      return null
    }
    return MatrixCursor(arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE)).apply {
      addRow(arrayOf<Any>(FILE_NAME, file.length()))
    }
  }

  override fun insert(uri: Uri, values: ContentValues?): Uri? = null

  override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<out String>?): Int = 0

  override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = 0

  companion object {
    /** src/lib/sharedLexicon.ts 의 ANDROID_DIR 와 같아야 한다 */
    const val DIR_NAME = "shared"
    const val FILE_NAME = "lexicon.json"
    const val MIME_TYPE = "application/json"
  }
}
